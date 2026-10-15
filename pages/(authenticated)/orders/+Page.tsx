import React, { Fragment, useEffect, useRef, useState } from "react";
import { OrderComponent } from "../../../src/components/Order.component";
import { useOrders } from "../../../src/services/orders.service/hook";
import OrderService, {
  FetchOrdersParam,
  SortDirection,
} from "../../../src/services/orders.service/orders.service";
import Carbon from "../../../src/utils/carbon";
import Input from "../../../src/components/Input";
import {
  ActivityIndicator,
  ArrowForward,
  SortAscIcon,
  SortDescIcon,
} from "../../../src/components/Icons";
import OrderSearchBar, {
  SearchHelp,
} from "../../../src/components/OrderSearchBar";
import {
  OrderSearch,
  SCOPE_LABEL,
} from "../../../src/services/orders.service/search";
import Order, { OrderItem } from "../../../src/services/orders.service/order";
import { postgrest, WithAuth } from "../../../src/utils/postgrest";
import Pagination from "../../../src/components/Pagination";
import List from "rc-virtual-list";

type Status =
  | "all"
  | "unconfirmed"
  | "confirmed"
  | "unassigned"
  | "assigned"
  | "pendingDelivery"
  | "delivered"
  | "archived";
type Refiner = "date" | "affiliate" | "category";

/**
 * One status at a time, each with one definition: `query` is what the server
 * filters on, `match` hides an order the moment an action moves it out of the list.
 *
 * Picking a status used to add others to a set ("Delivered" also turned on Confirmed
 * and Assigned). The server ANDed them, which hid delivered orders that weren't also
 * confirmed and assigned, and the page re-filtered once per status in the set with
 * the last one winning, so "Delivered" showed whatever "Assigned" let through.
 */
const STATUSES: {
  key: Status;
  label: string;
  hint: string;
  query: Partial<FetchOrdersParam>;
  match: (o: Order) => boolean;
}[] = [
  {
    key: "all",
    label: "All",
    hint: "Every order that isn't archived",
    query: {},
    match: () => true,
  },
  {
    key: "unconfirmed",
    label: "UnConfirmed",
    hint: "Not confirmed yet",
    query: { confirmed: false },
    match: (o) => !o.isComfirmed,
  },
  {
    key: "confirmed",
    label: "Confirmed",
    hint: "Confirmed, with or without an agent",
    query: { confirmed: true },
    match: (o) => o.isComfirmed,
  },
  {
    key: "unassigned",
    label: "UnAssigned",
    hint: "Confirmed and waiting for an agent",
    query: { confirmed: true, assigned: false },
    match: (o) => o.isComfirmed && !o.isAssignedToAgent,
  },
  {
    key: "assigned",
    label: "Assigned",
    hint: "Given to an agent",
    query: { assigned: true },
    match: (o) => o.isAssignedToAgent,
  },
  {
    key: "pendingDelivery",
    label: "PendingDelivery",
    hint: "With an agent, not delivered yet",
    query: { assigned: true, delivery_status: "pending" },
    match: (o) => o.isAssignedToAgent && o.deliveryStatus === "pending",
  },
  {
    key: "delivered",
    label: "Delivered",
    hint: "Marked delivered",
    query: { delivery_status: "delivered" },
    match: (o) => o.deliveryStatus === "delivered",
  },
  {
    key: "archived",
    label: "Archived",
    hint: "Hidden duplicates, kept on record",
    query: { archived: true },
    match: (o) => o.isArchived,
  },
];
const STATUS = Object.fromEntries(STATUSES.map((d) => [d.key, d])) as Record<
  Status,
  (typeof STATUSES)[number]
>;

const REFINERS: { key: Refiner; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "affiliate", label: "Affiliate" },
  { key: "category", label: "Category" },
];

/**
 * Saved filters. The old format was one array mixing statuses and refiners by label
 * ("Delivered", "Confirmed", "Assigned", "Date"); take the most specific status from
 * it so nobody's saved view jumps to All.
 */
const readSavedFilters = (
  saved: { status?: string; refiners?: string[]; filter?: string[] },
): { status: Status; refiners: Set<Refiner> } => {
  const byLabel = Object.fromEntries(
    [...STATUSES, ...REFINERS].map((d) => [d.label, d.key]),
  ) as Record<string, string>;
  const refiners = new Set<Refiner>(
    (saved.refiners ?? (saved.filter ?? []).map((l) => byLabel[l]))
      .filter((k): k is Refiner => REFINERS.some((r) => r.key === k)),
  );
  if (saved.status && saved.status in STATUS) {
    return { status: saved.status as Status, refiners };
  }
  const legacy = new Set((saved.filter ?? []).map((l) => byLabel[l]));
  const priority: Status[] = [
    "archived",
    "delivered",
    "pendingDelivery",
    "unassigned",
    "assigned",
    "unconfirmed",
    "confirmed",
  ];
  return { status: priority.find((k) => legacy.has(k)) ?? "all", refiners };
};

const SORT_KEY = "orders_sort";
const PER_PAGE = 100;

const readSort = (): SortDirection => {
  try {
    return localStorage.getItem(SORT_KEY) === "asc" ? "asc" : "desc";
  } catch {
    return "desc";
  }
};

export default function () {
  const __orders = useOrders();
  // Oldest-first is how the office works through a backlog (1 January on page 1), so
  // the direction is a choice, and it sticks between visits.
  const [sort, setSort] = useState<SortDirection>("desc");
  const [status, setStatus] = useState<Status>("all");
  const [refiners, setRefiners] = useState<Set<Refiner>>(new Set());
  const [affiliateFilter, setAffiliateFilter] = useState<Set<string>>(
    new Set(),
  );
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(new Set());
  const [dateFilter, setDateFilter] = useState<
    [Carbon | undefined, Carbon | undefined]
  >([undefined, undefined]);
  const [page, setPage] = useState(1);
  // A search looks across every order: it is how an admin finds one customer's
  // history, so the status/affiliate/category/date filters - which persist in
  // localStorage and are easy to forget are on - must not quietly narrow it.
  const [search, setSearch] = useState<OrderSearch>({ scope: "all", text: "" });
  const searching = search.text.trim() !== "";
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const loading = OrderService.instance.loading;
  const total = OrderService.instance.totalOrders;

  const [_ready, _setReady] = useState(false);
  const toolBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      let f: any = {};
      try {
        f = JSON.parse(localStorage.getItem("filters") ?? "{}");
      } catch {
        // Unreadable saved filters: start from All.
      }
      const saved = readSavedFilters(f);
      const _refiners = saved.refiners;
      let _affiliateFilter: Set<string> = new Set(f.affiliates ?? []);
      setCategoryFilter(new Set(f.categories ?? []));

      const aid = new URL(location.href).searchParams.get("affiliate");
      if (aid) {
        const { data, error } = await new WithAuth(
          postgrest
            .from("affiliates")
            .select("source_list")
            .eq("id", aid)
            .single(),
        ).unwrap();

        if (data) {
          _refiners.add("affiliate");
          (data.source_list as string[]).forEach((v) =>
            _affiliateFilter.add(v)
          );
        }
      }
      setStatus(saved.status);
      setRefiners(_refiners);
      setAffiliateFilter(_affiliateFilter);
      setSort(readSort());
      _setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!_ready) return;
    const data = {
      status,
      refiners: [...refiners.values()],
      affiliates: [...affiliateFilter.values()],
      categories: [...categoryFilter.values()],
    };
    try {
      localStorage.setItem("filters", JSON.stringify(data));
    } catch {
      // Blocked storage: the filters still apply for this visit.
    }
  }, [status, refiners, affiliateFilter, categoryFilter]);

  useEffect(() => {
    if (!_ready) return;
    try {
      localStorage.setItem(SORT_KEY, sort);
    } catch {
      // Private mode / blocked storage: the toggle still works for this visit.
    }
  }, [sort]);

  useEffect(() => {
    // Wait for the saved filters and sort, or the first paint fetches the wrong page
    // and the right one races it.
    if (!_ready) return;
    const archived = status === "archived";
    // The search lives in state and goes through this one fetch, so paging a long
    // result keeps the query instead of falling back to the unfiltered list.
    if (searching) {
      OrderService.instance.fetchOrders(page, {
        limit: PER_PAGE,
        search: search.text,
        searchIn: search.scope,
        sort,
        archived,
      });
      return;
    }
    OrderService.instance.fetchOrders(page, {
      limit: PER_PAGE,
      sort,
      ...STATUS[status].query,
      start_date: refiners.has("date")
        ? dateFilter[0]?.formatLocalISO()
        : undefined,
      end_date: refiners.has("date") ? dateFilter[1]?.formatLocalISO() : undefined,
      category: refiners.has("category")
        ? [...categoryFilter.values()]
        : undefined,
      source: refiners.has("affiliate")
        ? [...affiliateFilter.values()]
        : undefined,
    });
  }, [
    _ready,
    page,
    status,
    refiners,
    categoryFilter,
    affiliateFilter,
    dateFilter,
    search,
    sort,
  ]);

  // The same order the server paged in, so page 1 really is the oldest (or newest).
  const direction = sort === "asc" ? 1 : -1;
  const byCreated = (a: (typeof __orders)[number], b: (typeof __orders)[number]) =>
    direction * (a.createdAt.getTime() - b.createdAt.getTime());

  const applyFilter = () => {
    // The server has already done the matching; show all of it.
    if (searching) {
      return [...__orders].sort(byCreated);
    }
    // The server has filtered by the status and the refiners. This only takes out
    // an order an action has just moved out of the view (confirmed on UnConfirmed,
    // archived anywhere), before the refresh that follows comes back.
    const def = STATUS[status];
    let list = __orders.filter((o) =>
      status === "archived" ? o.isArchived : !o.isArchived && def.match(o)
    );

    // Strictly by date. Re-grouping a page by assigned / delivered status put a freshly
    // assigned order at the bottom of the list it was still in, and made the page order
    // disagree with the pagination.
    list = list.sort(byCreated);
    if (status === "delivered") {
      list = list.sort(
        (o, o1) =>
          direction *
          ((o.deliveredOn ? o.deliveredOn.getTime() : 0) -
            (o1.deliveredOn ? o1.deliveredOn.getTime() : 0)),
      );
    }
    return list;
  };

  const orders = applyFilter();

  // The timer is a ref: a plain `let` is redeclared on every render, and each fetch
  // re-renders the page, so it stopped debouncing after the first request.
  const debounce = (next: OrderSearch, delay = 300) => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      setSearch({ scope: next.scope, text: next.text.trim() });
    }, delay);
  };

  const pickStatus = (next: Status) => {
    setPage(1);
    setStatus(next);
  };
  const toggleRefiner = (refiner: Refiner) => {
    setPage(1);
    const next = new Set(refiners);
    next.has(refiner) ? next.delete(refiner) : next.add(refiner);
    if (refiner === "category" && next.has("category")) {
      setCategoryFilter(new Set(Object.values(OrderItem)));
    }
    setRefiners(next);
  };

  return (
    <div className="overflow-y-auto h-screen flex flex-col">
      <div
        ref={toolBarRef}
        className="sticky top-0 w-full z-50 flex flex-col gap-3 px-6 pt-5 pb-4 bg-zinc-50/90 backdrop-blur-md border-b border-zinc-200"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Orders</h1>
            <p className="text-sm text-zinc-500 tabular-nums">
              {loading
                ? "Loading…"
                : `${Intl.NumberFormat().format(total)}${
                  searching ? " matching" : ""
                }${status === "archived" ? " archived" : ""} order${
                  total === 1 ? "" : "s"
                }`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setPage(1);
              setSort(sort === "asc" ? "desc" : "asc");
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 shadow-sm hover:bg-zinc-50"
            title="Change the order of the list"
            aria-label={`Sorted ${
              sort === "asc" ? "oldest" : "newest"
            } first. Click to reverse.`}
          >
            {sort === "asc"
              ? <SortAscIcon className="size-4" />
              : <SortDescIcon className="size-4" />}
            <span className="font-medium">{sort === "asc" ? "ASC" : "DESC"}</span>
            <span className="text-zinc-500">
              {sort === "asc" ? "Oldest first" : "Newest first"}
            </span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <OrderSearchBar onSearch={debounce} loading={loading} />
          {searching && (
            <div className="text-xs text-zinc-500">
              {search.scope === "all"
                ? "Searching all "
                : `Searching by ${SCOPE_LABEL[search.scope].toLowerCase()} across all `}
              {status === "archived" ? "archived " : ""}
              orders - the other filters don't apply while a search is active.
            </div>
          )}
        </div>
        <SearchHelp />

        <div className="flex flex-wrap items-center gap-2">
          {STATUSES.map((d) => (
            <FilterButton
              key={d.key}
              label={d.label}
              title={d.hint}
              active={status === d.key}
              tone={d.key === "archived" ? "muted" : "status"}
              onClick={() => pickStatus(d.key)}
            />
          ))}

          <div className="mx-1 h-5 w-px bg-zinc-300" aria-hidden />

          {REFINERS.map((r) => (
            <FilterButton
              key={r.key}
              label={r.label}
              active={refiners.has(r.key)}
              tone="refine"
              onClick={() => toggleRefiner(r.key)}
            />
          ))}
        </div>
        {refiners.has("date") && (
          <div className="flex gap-3 items-center">
            <Input
              type="date"
              resetSize
              className="bg-transparent"
              onChange={(ev) => {
                setPage(1);
                dateFilter[0] = ev.target.value
                  ? new Carbon(ev.target.value)
                  : undefined;
                setDateFilter([...dateFilter]);
              }}
            />
            <ArrowForward className="size-5 text-zinc-400" />
            <Input
              type="date"
              resetSize
              className="bg-transparent"
              onChange={(ev) => {
                setPage(1);
                dateFilter[1] = ev.target.value
                  ? new Carbon(ev.target.value)
                  : undefined;
                setDateFilter([...dateFilter]);
              }}
            />
          </div>
        )}
        {refiners.has("affiliate") && (
          <div className="flex flex-wrap gap-2">
            {OrderService.instance.sourceList.map((source) => (
              <FilterButton
                key={source}
                label={source}
                active={affiliateFilter.has(source)}
                tone="refine"
                onClick={() => {
                  setPage(1);
                  affiliateFilter.has(source)
                    ? affiliateFilter.delete(source)
                    : affiliateFilter.add(source);
                  setAffiliateFilter(new Set([...affiliateFilter]));
                }}
              />
            ))}
          </div>
        )}

        {refiners.has("category") && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(OrderItem).map(([key, value]) => (
              <FilterButton
                key={key}
                label={value}
                active={categoryFilter.has(value)}
                tone="refine"
                onClick={() => {
                  setPage(1);
                  categoryFilter.has(value)
                    ? categoryFilter.delete(value)
                    : categoryFilter.add(value);
                  setCategoryFilter(new Set([...categoryFilter]));
                }}
              />
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 px-6 py-5 flex flex-col gap-4">
        {/* Keep the rows of a silent refresh on screen; only a real (re)load spins. */}
        {!loading && orders.length > 0 && (
          <List
            data={orders}
            itemKey={(o) => o.getUniqueID}
          >
            {(order) => (
              <OrderComponent
                key={order.getUniqueID}
                order={order}
              />
            )}
          </List>
        )}
        {!loading && orders.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-16 text-center">
            <div className="text-sm font-medium text-zinc-700">
              {searching
                ? search.scope === "order"
                  ? `No order numbered “${search.text}”`
                  : search.scope === "all"
                  ? `No orders match “${search.text}”`
                  : `No orders with ${SCOPE_LABEL[search.scope].toLowerCase()} matching “${search.text}”`
                : "No orders here"}
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              {searching
                ? search.scope === "order"
                  ? "Order numbers must match exactly. Remove the Order number chip to search every field."
                  : search.scope === "all"
                  ? "Try part of the name, the last digits of the phone, or the order number."
                  : `Remove the ${SCOPE_LABEL[search.scope]} chip to search every field.`
                : "Try another filter, or a different page."}
            </div>
          </div>
        )}
        {loading && (
          <div className="h-52 w-full flex flex-col justify-center items-center gap-2 text-sm text-zinc-500">
            <ActivityIndicator active className="size-6" />
            {searching ? "Searching…" : "Loading orders…"}
          </div>
        )}
      </div>
      <div className="sticky z-50 bottom-0 py-2 bg-white/95 backdrop-blur border-t border-zinc-200 w-full">
        <Pagination
          onNavigate={(page) => setPage(page)}
          perPage={PER_PAGE}
          total={total}
          page={page}
        />
      </div>
    </div>
  );
}

function FilterButton({
  label,
  active,
  onClick,
  title,
  tone = "status",
}: {
  label: string;
  active: boolean;
  onClick: VoidFunction;
  title?: string;
  tone?: "status" | "refine" | "muted";
}) {
  const on = tone === "refine"
    ? "bg-zinc-900 text-white border-zinc-900"
    : tone === "muted"
    ? "bg-zinc-600 text-white border-zinc-600"
    : "bg-green-600 text-white border-green-600";
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      className={`w-fit px-3 py-1 text-xs font-medium cursor-pointer rounded-full border transition-colors ${
        active
          ? on
          : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

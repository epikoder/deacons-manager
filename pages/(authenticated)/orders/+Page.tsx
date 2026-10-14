import React, { Fragment, useEffect, useRef, useState } from "react";
import { OrderComponent } from "../../../src/components/Order.component";
import { useOrders } from "../../../src/services/orders.service/hook";
import OrderService, {
  SortDirection,
} from "../../../src/services/orders.service/orders.service";
import Carbon from "../../../src/utils/carbon";
import Input from "../../../src/components/Input";
import {
  ActivityIndicator,
  ArrowForward,
  CloseIcon,
  SearchIcon,
  SortAscIcon,
  SortDescIcon,
} from "../../../src/components/Icons";
import { OrderItem } from "../../../src/services/orders.service/order";
import { postgrest, WithAuth } from "../../../src/utils/postgrest";
import Pagination from "../../../src/components/Pagination";
import List from "rc-virtual-list";

enum Filter {
  all = "All",
  pendingDelivery = "PendingDelivery",
  delivered = "Delivered",
  assigned = "Assigned",
  unassigned = "UnAssigned",
  confirmed = "Confirmed",
  unconfirmed = "UnConfirmed",
  archived = "Archived",
  affilate = "Affiliate",
  date = "Date",
  state = "State",
  category = "Category",
}

const SORT_KEY = "orders_sort";
const PER_PAGE = 100;

const readSort = (): SortDirection => {
  try {
    return localStorage.getItem(SORT_KEY) === "asc" ? "asc" : "desc";
  } catch {
    return "desc";
  }
};

/** Status filters are exclusive: picking one drops the others but keeps the refiners. */
const keepRefiners = (filter: Set<Filter>) => [
  ...(filter.has(Filter.date) ? [Filter.date] : []),
  ...(filter.has(Filter.affilate) ? [Filter.affilate] : []),
  ...(filter.has(Filter.category) ? [Filter.category] : []),
];

export default function () {
  const __orders = useOrders();
  // Oldest-first is how the office works through a backlog (1 January on page 1), so
  // the direction is a choice, and it sticks between visits.
  const [sort, setSort] = useState<SortDirection>("desc");
  const [filter, setFilter] = useState<Set<Filter>>(new Set());
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
  const [search, setSearch] = useState("");
  const [searchText, setSearchText] = useState("");
  const searching = search.trim() !== "";
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const loading = OrderService.instance.loading;
  const total = OrderService.instance.totalOrders;

  const [_ready, _setReady] = useState(false);
  const toolBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const f = JSON.parse(localStorage.getItem("filters") ?? "{}");
      let _filter: Set<Filter> = new Set(f.filter ?? [Filter.all]);
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
          _filter.add(Filter.affilate);
          (data.source_list as string[]).forEach((v) =>
            _affiliateFilter.add(v)
          );
        }
      }
      setFilter(_filter);
      setAffiliateFilter(_affiliateFilter);
      setSort(readSort());
      _setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!_ready) return;
    const data = {
      filter: [...filter.values()],
      affiliates: [...affiliateFilter.values()],
      categories: [...categoryFilter.values()],
    };
    localStorage.setItem(
      "filters",
      JSON.stringify(data),
    );
  }, [filter, affiliateFilter, categoryFilter]);

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
    const archived = filter.has(Filter.archived);
    // The search lives in state and goes through this one fetch, so paging a long
    // result keeps the query instead of falling back to the unfiltered list.
    if (searching) {
      OrderService.instance.fetchOrders(page, {
        limit: PER_PAGE,
        search,
        sort,
        archived,
      });
      return;
    }
    OrderService.instance.fetchOrders(page, {
      limit: PER_PAGE,
      sort,
      archived,
      start_date: dateFilter[0]?.formatLocalISO(),
      end_date: dateFilter[1]?.formatLocalISO(),
      confirmed: filter.has(Filter.confirmed)
        ? true
        : filter.has(Filter.unconfirmed)
        ? false
        : undefined,
      assigned: filter.has(Filter.assigned)
        ? true
        : filter.has(Filter.unassigned)
        ? false
        : undefined,
      category: filter.has(Filter.category)
        ? [...categoryFilter.values()]
        : undefined,
      delivery_status: filter.has(Filter.pendingDelivery)
        ? "pending"
        : filter.has(Filter.delivered)
        ? "delivered"
        : undefined,
      source: filter.has(Filter.affilate)
        ? [...affiliateFilter.values()]
        : undefined,
    });
  }, [_ready, page, filter, categoryFilter, affiliateFilter, dateFilter, search, sort]);

  // The same order the server paged in, so page 1 really is the oldest (or newest).
  const direction = sort === "asc" ? 1 : -1;
  const byCreated = (a: (typeof __orders)[number], b: (typeof __orders)[number]) =>
    direction * (a.createdAt.getTime() - b.createdAt.getTime());

  const applyFilter = () => {
    // The server has already done the matching; show all of it.
    if (searching) {
      return [...__orders].sort(byCreated);
    }
    let __: typeof __orders = [];
    for (const key of filter) {
      switch (key) {
        case Filter.unconfirmed:
          __ = [...__, ...__orders].unique().filter((o) => !o.isComfirmed);
          break;
        case Filter.confirmed:
          __ = [...__, ...__orders].unique().filter((o) => o.isComfirmed);
          break;
        case Filter.unassigned:
          __ = [...__, ...__orders]
            .unique()
            .filter((o) => !o.isAssignedToAgent && o.isComfirmed);
          break;
        case Filter.assigned:
          __ = [...__, ...__orders]
            .unique()
            .filter((o) => o.isAssignedToAgent && o.isComfirmed);
          break;
        case Filter.pendingDelivery:
          __ = [...__, ...__orders]
            .unique()
            .filter(
              (o) =>
                o.isAssignedToAgent &&
                o.isComfirmed &&
                o.deliveryStatus == "pending",
            );
          break;
        case Filter.delivered:
          __ = [...__, ...__orders]
            .unique()
            .filter(
              (o) =>
                o.isAssignedToAgent &&
                o.isComfirmed &&
                o.deliveryStatus == "delivered",
            );
          break;

        case Filter.archived:
          __ = [...__, ...__orders].unique().filter((o) => o.isArchived);
          break;

        case Filter.date:
        case Filter.category:
        case Filter.affilate:
          break;

        default:
          __ = [...__orders];
          break;
      }
    }

    if (filter.has(Filter.date)) {
      __ = __.unique().filter((o) => {
        return (
          (dateFilter[0] ? o.isAfter(dateFilter[0]) : true) &&
          (dateFilter[1] ? o.isBefore(dateFilter[1]) : true)
        );
      });
    }

    if (filter.has(Filter.affilate)) {
      __ = __.unique().filter((o) => affiliateFilter.has(o.source));
    }

    if (filter.has(Filter.category)) {
      __ = __.unique().filter((o) => categoryFilter.has(o.orderItem));
    }

    // Strictly by date. Re-grouping a page by assigned / delivered status put a freshly
    // assigned order at the bottom of the list it was still in, and made the page order
    // disagree with the pagination.
    __ = __.sort(byCreated);
    if (filter.has(Filter.delivered)) {
      __ = __.sort(
        (o, o1) =>
          direction *
          ((o.deliveredOn ? o.deliveredOn.getTime() : 0) -
            (o1.deliveredOn ? o1.deliveredOn.getTime() : 0)),
      );
    }
    return __;
  };

  const orders = applyFilter();

  // The timer is a ref: a plain `let` is redeclared on every render, and each fetch
  // re-renders the page, so it stopped debouncing after the first request.
  const debounce = (text: string, delay = 300) => {
    setSearchText(text);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      setSearch(text.trim());
    }, delay);
  };

  // Status chips are exclusive; Confirmed is implied by the agent / delivery ones.
  const pickStatus = (status: Filter, implies: Filter[] = []) => {
    setPage(1);
    setFilter(new Set([status, ...implies, ...keepRefiners(filter)]));
  };
  const toggleRefiner = (refiner: Filter) => {
    setPage(1);
    filter.has(refiner) ? filter.delete(refiner) : filter.add(refiner);
    if (refiner === Filter.category && filter.has(Filter.category)) {
      setCategoryFilter(new Set(Object.values(OrderItem)));
    }
    setFilter(new Set([...filter]));
  };
  const isStatus = (f: Filter) => filter.has(f);

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
                }${filter.has(Filter.archived) ? " archived" : ""} order${
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
          <div className="relative w-full max-w-md">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
            <input
              name="search"
              type="search"
              value={searchText}
              autoComplete="off"
              placeholder="Search name, phone or order number…"
              className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-9 pr-9 text-sm outline-none transition-shadow placeholder:text-zinc-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 [&::-webkit-search-cancel-button]:hidden"
              onChange={(ev) => debounce(ev.currentTarget.value)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter") debounce(ev.currentTarget.value, 0);
                if (ev.key === "Escape") debounce("", 0);
              }}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
              {searching && loading
                ? (
                  <ActivityIndicator
                    active
                    className="size-4 text-zinc-400 m-1"
                  />
                )
                : searchText && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
                    onClick={() => debounce("", 0)}
                  >
                    <CloseIcon className="size-4" />
                  </button>
                )}
            </div>
          </div>
          {searching && (
            <div className="text-xs text-zinc-500">
              Searching all {filter.has(Filter.archived) ? "archived " : ""}
              orders - the other filters don't apply while a search is active.
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterButton
            activeFilter={filter}
            filter={Filter.all}
            onClick={() => {
              setPage(1);
              setFilter(new Set([Filter.all]));
            }}
          />
          <FilterButton
            activeFilter={filter}
            filter={Filter.unconfirmed}
            onClick={() => pickStatus(Filter.unconfirmed)}
          />
          <FilterButton
            activeFilter={filter}
            filter={Filter.confirmed}
            onClick={() => pickStatus(Filter.confirmed)}
          />
          <FilterButton
            activeFilter={filter}
            filter={Filter.unassigned}
            onClick={() => pickStatus(Filter.unassigned, [Filter.confirmed])}
          />
          <FilterButton
            activeFilter={filter}
            filter={Filter.assigned}
            onClick={() => pickStatus(Filter.assigned, [Filter.confirmed])}
          />
          <FilterButton
            activeFilter={filter}
            filter={Filter.pendingDelivery}
            onClick={() =>
              pickStatus(Filter.pendingDelivery, [Filter.confirmed])}
          />
          <FilterButton
            activeFilter={filter}
            filter={Filter.delivered}
            onClick={() =>
              pickStatus(Filter.delivered, [Filter.confirmed, Filter.assigned])}
          />
          <FilterButton
            activeFilter={filter}
            filter={Filter.archived}
            tone="muted"
            onClick={() => pickStatus(Filter.archived)}
          />

          <div className="mx-1 h-5 w-px bg-zinc-300" aria-hidden />

          <FilterButton
            activeFilter={filter}
            filter={Filter.date}
            tone="refine"
            onClick={() => toggleRefiner(Filter.date)}
          />
          <FilterButton
            activeFilter={filter}
            filter={Filter.affilate}
            tone="refine"
            onClick={() => toggleRefiner(Filter.affilate)}
          />
          <FilterButton
            activeFilter={filter}
            filter={Filter.category}
            tone="refine"
            onClick={() => toggleRefiner(Filter.category)}
          />
        </div>
        {isStatus(Filter.date) && (
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
        {isStatus(Filter.affilate) && (
          <div className="flex flex-wrap gap-2">
            {OrderService.instance.sourceList.map((source) => (
              <FilterButton
                key={source}
                filter={source}
                activeFilter={affiliateFilter}
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

        {isStatus(Filter.category) && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(OrderItem).map(([key, value]) => (
              <FilterButton
                key={key}
                filter={value}
                activeFilter={categoryFilter}
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
                ? `No orders match “${search}”`
                : "No orders here"}
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              {searching
                ? "Try part of the name, the last digits of the phone, or the order number."
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

function FilterButton<T>({
  filter,
  activeFilter,
  onClick,
  tone = "status",
}: {
  filter: T;
  activeFilter: Set<T>;
  onClick: VoidFunction;
  tone?: "status" | "refine" | "muted";
}) {
  const active = activeFilter.has(filter);
  const on = tone === "refine"
    ? "bg-zinc-900 text-white border-zinc-900"
    : tone === "muted"
    ? "bg-zinc-600 text-white border-zinc-600"
    : "bg-green-600 text-white border-green-600";
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`w-fit px-3 py-1 text-xs font-medium cursor-pointer rounded-full border transition-colors ${
        active
          ? on
          : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
      }`}
      onClick={onClick}
    >
      {String(filter)}
    </button>
  );
}

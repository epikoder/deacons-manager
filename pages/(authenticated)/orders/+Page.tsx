import React, { Fragment, useEffect, useRef, useState } from "react";
import { OrderComponent } from "../../../src/components/Order.component";
import { useOrders } from "../../../src/services/orders.service/hook";
import OrderService from "../../../src/services/orders.service/orders.service";
import Carbon from "../../../src/utils/carbon";
import Input from "../../../src/components/Input";
import { ActivityIndicator, ArrowForward } from "../../../src/components/Icons";
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
  affilate = "Affiliate",
  date = "Date",
  state = "State",
  category = "Category",
}

export default function () {
  const __orders = useOrders();
  const [filter, setFilter] = useState<Set<Filter>>(new Set());
  const [affiliateFilter, setAffiliateFilter] = useState<Set<string>>(
    new Set(),
  );
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(new Set());
  const [dateFilter, setDateFilter] = useState<
    [Carbon | undefined, Carbon | undefined]
  >([undefined, undefined]);
  const [page, setPage] = useState(1);

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
    console.log(data);
    localStorage.setItem(
      "filters",
      JSON.stringify(data),
    );
  }, [filter, affiliateFilter, categoryFilter]);

  useEffect(() => {
    OrderService.instance.fetchOrders(page, {
      limit: 100,
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
  }, [page, filter, categoryFilter, affiliateFilter, dateFilter]);

  const applyFilter = () => {
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

    __ = __.sort((o, o1) => o1.createdAt.getTime() - o.createdAt.getTime())
      .sort(
        (o, o1) =>
          (o.isAssignedToAgent ? 1 : 0) - (o1.isAssignedToAgent ? 1 : 0),
      )
      .sort((o, o1) => o.deliveryStatusWeight - o1.deliveryStatusWeight);
    if (filter.has(Filter.delivered)) {
      __ = __.sort(
        (o, o1) =>
          (o1.deliveredOn ? o1.deliveredOn.getTime() : 0) -
          (o.deliveredOn ? o.deliveredOn.getTime() : 0),
      );
    }
    return __;
  };

  const orders = applyFilter();

  let interval: ReturnType<typeof setTimeout>;
  const debounce = (text: string) => {
    clearTimeout(interval);
    interval = setTimeout(async () => {
      const a = await OrderService.instance.fetchOrders(1, {
        limit: 100,
        phone: text,
      });
    }, 500);
  };

  return (
    <div className="overflow-scroll h-screen flex flex-col gap-4">
      <div
        ref={toolBarRef}
        className="sticky top-0 w-full z-50 flex flex-col gap-3 p-4 backdrop-blur-md bg-transparent"
      >
        <div className="flex flex-wrap gap-4">
          <FilterButton
            activeFilter={filter}
            filter={Filter.all}
            onClick={() => {
              setFilter(new Set([Filter.all]));
            }}
          />
          <FilterButton
            activeFilter={filter}
            filter={Filter.unconfirmed}
            onClick={() => {
              setFilter(
                new Set([
                  Filter.unconfirmed,
                  ...(filter.has(Filter.date) ? [Filter.date] : []),
                  ...(filter.has(Filter.affilate) ? [Filter.affilate] : []),
                  ...(filter.has(Filter.category) ? [Filter.category] : []),
                ]),
              );
            }}
          />
          <FilterButton
            activeFilter={filter}
            filter={Filter.confirmed}
            onClick={() => {
              setFilter(
                new Set([
                  Filter.confirmed,
                  ...(filter.has(Filter.date) ? [Filter.date] : []),
                  ...(filter.has(Filter.affilate) ? [Filter.affilate] : []),
                  ...(filter.has(Filter.category) ? [Filter.category] : []),
                ]),
              );
            }}
          />

          <FilterButton
            activeFilter={filter}
            filter={Filter.unassigned}
            onClick={() => {
              filter.delete(Filter.all);
              filter.delete(Filter.unconfirmed);
              filter.delete(Filter.assigned);
              filter.delete(Filter.pendingDelivery);
              filter.delete(Filter.delivered);
              filter.add(Filter.confirmed);
              filter.add(Filter.unassigned);
              setFilter(new Set([...filter]));
            }}
          />
          <FilterButton
            activeFilter={filter}
            filter={Filter.assigned}
            onClick={() => {
              filter.delete(Filter.all);
              filter.delete(Filter.unconfirmed);
              filter.delete(Filter.unassigned);
              filter.delete(Filter.pendingDelivery);
              filter.delete(Filter.delivered);
              filter.add(Filter.confirmed);
              filter.add(Filter.assigned);
              setFilter(new Set([...filter]));
            }}
          />
          <FilterButton
            activeFilter={filter}
            filter={Filter.pendingDelivery}
            onClick={() => {
              filter.delete(Filter.all);
              filter.delete(Filter.unconfirmed);
              filter.delete(Filter.unassigned);
              filter.delete(Filter.delivered);
              filter.add(Filter.confirmed);
              filter.add(Filter.pendingDelivery);
              setFilter(new Set([...filter]));
            }}
          />

          <FilterButton
            activeFilter={filter}
            filter={Filter.delivered}
            onClick={() => {
              filter.delete(Filter.all);
              filter.delete(Filter.unconfirmed);
              filter.delete(Filter.unassigned);
              filter.delete(Filter.pendingDelivery);
              filter.add(Filter.confirmed);
              filter.add(Filter.assigned);
              filter.add(Filter.delivered);
              setFilter(new Set([...filter]));
            }}
          />
          <div className="px-px bg-black" />

          <FilterButton
            activeFilter={filter}
            filter={Filter.date}
            onClick={() => {
              filter.has(Filter.date)
                ? filter.delete(Filter.date)
                : filter.add(Filter.date);
              setFilter(new Set([...filter]));
            }}
          />
          <FilterButton
            activeFilter={filter}
            filter={Filter.affilate}
            onClick={() => {
              filter.has(Filter.affilate)
                ? filter.delete(Filter.affilate)
                : filter.add(Filter.affilate);
              setFilter(new Set([...filter]));
            }}
          />
          <FilterButton
            activeFilter={filter}
            filter={Filter.category}
            onClick={() => {
              filter.has(Filter.category)
                ? filter.delete(Filter.category)
                : filter.add(Filter.category);
              if (filter.has(Filter.category)) {
                setCategoryFilter(new Set(Object.values(OrderItem)));
              }
              setFilter(new Set([...filter]));
            }}
          />
        </div>
        {filter.has(Filter.date) && (
          <div className="flex gap-4 items-center">
            <Input
              type="date"
              resetSize
              className="bg-transparent"
              onChange={(ev) => {
                dateFilter[0] = ev.target.value
                  ? new Carbon(ev.target.value)
                  : undefined;
                setDateFilter([...dateFilter]);
              }}
            />
            <ArrowForward className="size-10" />
            <Input
              type="date"
              resetSize
              className="bg-transparent"
              onChange={(ev) => {
                dateFilter[1] = ev.target.value
                  ? new Carbon(ev.target.value)
                  : undefined;
                setDateFilter([...dateFilter]);
              }}
            />
          </div>
        )}
        {filter.has(Filter.affilate) && (
          <div className="flex flex-wrap gap-4">
            {OrderService.instance.sourceList.map((source) => (
              <FilterButton
                key={source}
                filter={source}
                activeFilter={affiliateFilter}
                onClick={() => {
                  affiliateFilter.has(source)
                    ? affiliateFilter.delete(source)
                    : affiliateFilter.add(source);
                  setAffiliateFilter(new Set([...affiliateFilter]));
                }}
              />
            ))}
          </div>
        )}

        {filter.has(Filter.category) && (
          <div className="flex flex-wrap gap-4">
            {Object.entries(OrderItem).map(([key, value]) => (
              <FilterButton
                key={key}
                filter={value}
                activeFilter={categoryFilter}
                onClick={() => {
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
      <div className="max-w-screen-sm p-4">
        <Input
          name="search"
          placeholder="Search phone..."
          sx="col-span-5 w-full"
          onChange={(ev) => debounce(ev.currentTarget.value)}
        />
      </div>
      <div className="px-4 flex flex-col gap-4">
        {!OrderService.instance.loading && (
          <List
            data={orders}
            itemKey={(o) => o.ID!}
          >
            {(order, key) => (
              <OrderComponent
                key={`${order.getUniqueID}-${new Date().getTime()}`}
                order={order}
              />
            )}
          </List>
        )}
        {OrderService.instance.loading && (
          <div className="h-52 w-full flex flex-col justify-center items-center">
            <ActivityIndicator active />
          </div>
        )}
      </div>
      <div className="sticky z-50 bottom-0 py-2 bg-white w-full">
        <Pagination
          onNavigate={(page) => setPage(page)}
          perPage={100}
          total={OrderService.instance.totalOrders}
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
}: {
  filter: T;
  activeFilter: Set<T>;
  onClick: VoidFunction;
}) {
  return (
    <div
      className={`w-fit px-2 py-[2px] text-sm cursor-pointer rounded-md border ${
        activeFilter.has(filter)
          ? "bg-green-500 text-white border-green-500 hover:bg-green-600"
          : "border-zinc-500 bg-zinc-100 hover:bg-zinc-200"
      }`}
      onClick={onClick}
    >
      {String(filter)}
    </div>
  );
}

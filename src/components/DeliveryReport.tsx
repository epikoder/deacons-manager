import { useEffect, useRef, useState } from "react";
import { postgrest, WithAuth } from "../utils/postgrest";
import Order from "../services/orders.service/order";
import printer from "../utils/printer";
import { MONTH_NAMES, yearOptions } from "../hooks/useOrderStats";
import {
  EmptyState,
  fmtCount,
  PageBody,
  PageHeader,
  primaryButton,
  selectClass,
  StatTile,
} from "./ui";
import { ActivityIndicator } from "./Icons";

type Query = ReturnType<ReturnType<typeof postgrest.from>["select"]>;

const pad = (n: number) => String(n).padStart(2, "0");
const day = (y: number, m: number) => `${y}-${pad(m + 1)}-01`;
const PAGE = 1000;

/**
 * Delivered orders for one agent or affiliate over a month or a whole year, with
 * what they earned on each. Shared by both report pages, which were copies.
 */
export default function DeliveryReport(
  { title, name, back, scope, earning, earningLabel, empty }: {
    title: string;
    name: string;
    back: { href: string; label: string };
    /** Narrows the orders query to this person's orders. */
    scope: (q: Query) => Query;
    earning: (o: Order) => number;
    earningLabel: string;
    /** Set when the person can have no orders at all (an affiliate with no sources). */
    empty?: string;
  },
) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | "all">(now.getMonth());
  const [orders, setOrders] = useState<Order[] | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const lastMonth = year === now.getFullYear() ? now.getMonth() : 11;

  useEffect(() => {
    if (month !== "all" && month > lastMonth) setMonth(lastMonth);
  }, [year]);

  useEffect(() => {
    let live = true;
    setOrders(null);
    if (empty) {
      setOrders([]);
      return;
    }
    // [start, end): a whole year, or one month. The old report sent a 1-based month
    // to a 0-based helper, so picking January reported February.
    const start = month === "all" ? `${year}-01-01` : day(year, month);
    const end = month === "all"
      ? `${year + 1}-01-01`
      : month === 11
      ? `${year + 1}-01-01`
      : day(year, month + 1);

    (async () => {
      let rows: IOrder[] = [];
      // It used to fetch two rows per request; a busy month took hundreds.
      for (let from = 0;; from += PAGE) {
        const { data, error } = await new WithAuth(
          scope(postgrest.from("orders").select("*"))
            .not("delivered_on", "is", null)
            .gte("delivered_on", start)
            .lt("delivered_on", end)
            .order("delivered_on", { ascending: false })
            .range(from, from + PAGE - 1),
        ).unwrap();
        if (error) {
          console.error("report query failed", error);
          break;
        }
        rows = rows.concat(data as IOrder[]);
        if ((data as IOrder[]).length < PAGE) break;
      }
      if (live) setOrders(rows.map((o) => new Order(o)));
    })();
    return () => {
      live = false;
    };
  }, [year, month, empty]);

  const totalEarning = (orders ?? []).reduce((s, o) => s + earning(o), 0);
  const period = month === "all" ? String(year) : `${MONTH_NAMES[month]} ${year}`;

  return (
    <PageBody>
      <PageHeader
        title={title}
        subtitle={name}
        back={back}
        actions={
          <button
            type="button"
            className={primaryButton}
            disabled={!orders?.length}
            onClick={() => printRef.current && printer(printRef.current)}
          >
            Print
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Month"
          className={selectClass}
          value={month}
          onChange={(ev) =>
            setMonth(
              ev.currentTarget.value === "all"
                ? "all"
                : parseInt(ev.currentTarget.value),
            )}
        >
          <option value="all">All months</option>
          {MONTH_NAMES.slice(0, lastMonth + 1).map((m, i) => (
            <option key={m} value={i}>{m}</option>
          ))}
        </select>
        <select
          aria-label="Year"
          className={selectClass}
          value={year}
          onChange={(ev) => setYear(parseInt(ev.currentTarget.value))}
        >
          {yearOptions().map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile
          label={`Deliveries · ${period}`}
          value={orders ? fmtCount(orders.length) : undefined}
        />
        <StatTile
          label={`${earningLabel} · ${period}`}
          value={orders ? totalEarning.asLocalCurrency() : undefined}
        />
      </div>

      {!orders && (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-zinc-500">
          <ActivityIndicator active className="size-5" /> Loading deliveries…
        </div>
      )}
      {orders && orders.length === 0 && (
        <EmptyState
          title={empty ?? `No deliveries in ${period}`}
          hint={empty ? undefined : "Try another month or the whole year."}
        />
      )}
      {orders && orders.length > 0 && (
        <div
          ref={printRef}
          className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm"
        >
          {/* Shown on paper only: the page header is not part of the print. */}
          <div className="hidden px-4 pt-4 text-base font-semibold print:block">
            {title} · {name} · {period}
          </div>
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-medium text-zinc-500">
              <tr>
                <th className="px-4 py-2.5">#</th>
                <th className="px-4 py-2.5">Order</th>
                <th className="px-4 py-2.5">Item</th>
                <th className="px-4 py-2.5">Books</th>
                <th className="px-4 py-2.5">Address</th>
                <th className="px-4 py-2.5 whitespace-nowrap">Delivered</th>
                <th className="px-4 py-2.5 text-right">{earningLabel}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {orders.map((o, i) => (
                <tr key={o.getUniqueID} className="align-top">
                  <td className="px-4 py-2.5 tabular-nums text-zinc-400">
                    {i + 1}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <div className="font-medium tabular-nums">
                      #{o.orderNumber}
                    </div>
                    <div className="text-xs text-zinc-500">{o.source}</div>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{o.orderItem}</td>
                  <td className="px-4 py-2.5 text-xs text-zinc-600">
                    {Object.entries(o.books ?? {})
                      .map(([b, n]) => `${b} ×${n}`)
                      .join(", ") || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-600">
                    {[o.address, o.state].filter(Boolean).join(", ")}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">
                    {o.deliveredOn ? o.deliveredOn.format() : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                    {earning(o).asLocalCurrency()}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-zinc-200 bg-zinc-50">
              <tr>
                <td colSpan={6} className="px-4 py-2.5 text-right font-semibold">
                  Total
                </td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                  {totalEarning.asLocalCurrency()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </PageBody>
  );
}

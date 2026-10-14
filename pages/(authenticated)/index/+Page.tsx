import { Fragment, ReactNode, useEffect, useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { postgrest, WithAuth } from "../../../src/utils/postgrest";
import { ChevronDown, ChevronUp } from "../../../src/components/Icons";
import { OrderComponent } from "../../../src/components/Order.component";
import DropDown from "../../../src/components/Dropdown";
import { useOrders } from "../../../src/services/orders.service/hook";
import { useLoadBookDistribution } from "../../../src/hooks/useLoadBookDistribution";
import { Bar } from "react-chartjs-2";
import {
  BarElement,
  CategoryScale,
  Chart,
  ChartOptions,
  Legend,
  LinearScale,
  Plugin,
  Tooltip,
} from "chart.js";
import Carbon from "../../../src/utils/carbon";
import Expanded from "../../../src/components/Expanded";

Chart.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

// Chart roles. Delivered/pending are two series of one stack, so they take the first
// two categorical slots (validated: CVD ΔE 24.7, normal-vision ΔE 33.6, both >= 3:1).
const VIZ = {
  delivered: "#2a78d6",
  pending: "#eb6834",
  bar: "#2a78d6",
  surface: "#ffffff",
  grid: "#f0f0ee",
  textPrimary: "#18181b",
  textSecondary: "#71717a",
};
const FONT = { family: "Outfit", size: 11 };
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const TOP_N = 10;
const fmt = (n: number) => Intl.NumberFormat().format(n);

type MonthRow = {
  month: string;
  order_count: number;
  pending_count: number;
  delivered_count: number;
};
type SourceRow = MonthRow & { source: string };
type StateRow = MonthRow & { state: string };

export default function () {
  const context = usePageContext();
  const [year, setYear] = useState(new Date().getFullYear());
  const [bySource, setBySource] = useState<SourceRow[] | null>(null);
  const [byState, setByState] = useState<StateRow[] | null>(null);

  useEffect(() => {
    setBySource(null);
    setByState(null);
    new WithAuth(
      postgrest.rpc("cummulative_orders_for_affiliate_by_month", { year }),
    ).unwrap().then(({ data }) => setBySource((data ?? []) as SourceRow[]));
    new WithAuth(postgrest.rpc("cummulative_orders_by_state", { year }))
      .unwrap().then(({ data }) => setByState((data ?? []) as StateRow[]));
  }, [year]);

  // Months that have happened: the current year stops at this month, so the chart
  // doesn't end in a run of empty future columns that read as "orders fell to zero".
  const monthCount = Carbon.lastMonthOfYear(year);

  const monthly = useMemo(() => {
    const delivered = Array(monthCount).fill(0);
    const pending = Array(monthCount).fill(0);
    for (const r of bySource ?? []) {
      const m = parseInt(String(r.month).slice(5, 7)) - 1;
      if (m < 0 || m >= monthCount) continue;
      delivered[m] += Number(r.delivered_count);
      pending[m] += Number(r.order_count) - Number(r.delivered_count);
    }
    return { delivered, pending };
  }, [bySource, monthCount]);

  const totals = useMemo(() => {
    const delivered = monthly.delivered.sum();
    const pending = monthly.pending.sum();
    return { orders: delivered + pending, delivered, pending };
  }, [monthly]);

  const thisMonth = new Date().getMonth();
  const isCurrentYear = year === new Date().getFullYear();

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-6 flex flex-col gap-5 max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">
              Hello, {context.config.user!.fullname}
            </h1>
            <p className="text-sm text-zinc-500">
              {new Carbon().toLocaleDateString(undefined, {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            Year
            <select
              value={year}
              onChange={(ev) => setYear(parseInt(ev.currentTarget.value))}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
            >
              {Array.from(Array(new Carbon().getFullYear() - 2024 + 1).keys())
                .map((k) => new Carbon().getFullYear() - k)
                .map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatTile
            label={`Orders in ${year}`}
            value={bySource ? fmt(totals.orders) : undefined}
            hint={isCurrentYear && bySource
              ? `${fmt(
                monthly.delivered[thisMonth] + monthly.pending[thisMonth],
              )} this month`
              : undefined}
          />
          <StatTile
            label="Delivered"
            value={bySource ? fmt(totals.delivered) : undefined}
            hint={bySource && totals.orders
              ? `${Math.round((totals.delivered / totals.orders) * 100)}% of orders`
              : undefined}
            swatch={VIZ.delivered}
          />
          <StatTile
            label="Pending delivery"
            value={bySource ? fmt(totals.pending) : undefined}
            swatch={VIZ.pending}
          />
          <UserMetric />
        </div>

        <Card
          title="Orders per month"
          subtitle={`${year} · archived duplicates excluded`}
          loading={!bySource}
          empty={bySource?.length === 0}
        >
          <MonthlyOrdersChart
            labels={MONTHS.slice(0, monthCount)}
            delivered={monthly.delivered}
            pending={monthly.pending}
          />
        </Card>

        <div className="grid lg:grid-cols-2 gap-5">
          <Card
            title="Orders by affiliate"
            subtitle={`${year} · ranked`}
            loading={!bySource}
            empty={bySource?.length === 0}
          >
            <RankedBars
              rows={rankBy(bySource ?? [], (r) => r.source)}
              label="Orders"
            />
          </Card>
          <Card
            title="Orders by state"
            subtitle={`${year} · top ${TOP_N}`}
            loading={!byState}
            empty={byState?.length === 0}
          >
            <RankedBars
              rows={rankBy(byState ?? [], (r) => r.state)}
              label="Orders"
            />
          </Card>
        </div>

        <RecentOrdersCard />
        <BooksCard />
      </div>
    </div>
  );
}

/** Sum a year of monthly rows per key, largest first; the long tail folds into one row. */
function rankBy<T extends MonthRow>(rows: T[], key: (r: T) => string) {
  const sums = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    sums.set(k, (sums.get(k) ?? 0) + Number(r.order_count));
  }
  const ranked = [...sums.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  if (ranked.length <= TOP_N + 1) return ranked;
  const rest = ranked.slice(TOP_N);
  return [
    ...ranked.slice(0, TOP_N),
    [
      `${rest.length} others`,
      rest.reduce((s, [, v]) => s + v, 0),
    ] as [string, number],
  ];
}

function Card(
  { title, subtitle, children, loading, empty }: {
    title: string;
    subtitle?: string;
    children: ReactNode;
    loading?: boolean;
    empty?: boolean;
  },
) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white shadow-sm p-5">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
        {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
      </div>
      {loading
        ? <div className="h-64 animate-pulse rounded-lg bg-zinc-100" />
        : empty
        ? (
          <div className="h-64 grid place-items-center text-sm text-zinc-400">
            No orders for this year
          </div>
        )
        : children}
    </section>
  );
}

function StatTile(
  { label, value, hint, swatch }: {
    label: string;
    value?: string;
    hint?: string;
    swatch?: string;
  },
) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
        {swatch && (
          <span
            className="size-2 rounded-sm"
            style={{ background: swatch }}
            aria-hidden
          />
        )}
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-zinc-900 tabular-nums">
        {value ?? (
          <span className="inline-block h-7 w-16 animate-pulse rounded bg-zinc-100" />
        )}
      </div>
      {hint && <div className="text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

const baseTooltip: ChartOptions<"bar">["plugins"] = {
  tooltip: {
    backgroundColor: "#18181b",
    titleFont: { ...FONT, size: 12, weight: "bold" },
    bodyFont: { ...FONT, size: 12 },
    padding: 10,
    cornerRadius: 8,
    boxPadding: 4,
    usePointStyle: true,
  },
};

function MonthlyOrdersChart(
  { labels, delivered, pending }: {
    labels: string[];
    delivered: number[];
    pending: number[];
  },
) {
  return (
    <div className="h-72">
      <Bar
        data={{
          labels,
          datasets: [
            {
              label: "Delivered",
              data: delivered,
              backgroundColor: VIZ.delivered,
              maxBarThickness: 24,
              borderSkipped: "start",
            },
            {
              // The top segment carries the rounded data-end and a 2px surface gap
              // separating it from the segment below.
              label: "Pending delivery",
              data: pending,
              backgroundColor: VIZ.pending,
              borderColor: VIZ.surface,
              borderWidth: { top: 0, bottom: 2, left: 0, right: 0 },
              borderRadius: { topLeft: 4, topRight: 4 },
              borderSkipped: false,
              maxBarThickness: 24,
            },
          ],
        }}
        options={{
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          scales: {
            x: {
              stacked: true,
              grid: { display: false },
              border: { color: "#d4d4d8" },
              ticks: { color: VIZ.textSecondary, font: FONT },
            },
            y: {
              stacked: true,
              beginAtZero: true,
              grid: { color: VIZ.grid },
              border: { display: false },
              ticks: {
                color: VIZ.textSecondary,
                font: FONT,
                precision: 0,
                maxTicksLimit: 6,
              },
            },
          },
          plugins: {
            ...baseTooltip,
            legend: {
              position: "top",
              align: "end",
              labels: {
                usePointStyle: true,
                pointStyle: "rectRounded",
                boxWidth: 8,
                boxHeight: 8,
                color: VIZ.textPrimary,
                font: { ...FONT, size: 12 },
              },
            },
            tooltip: {
              ...baseTooltip.tooltip,
              callbacks: {
                footer: (items) =>
                  `Total: ${fmt(items.reduce((s, i) => s + (i.raw as number), 0))}`,
              },
            },
          },
        }}
      />
    </div>
  );
}

/** Writes each bar's value just past its end, in text ink rather than the bar colour. */
const endLabels: Plugin<"bar"> = {
  id: "endLabels",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.font = `600 11px ${FONT.family}`;
    ctx.fillStyle = VIZ.textPrimary;
    ctx.textBaseline = "middle";
    chart.getDatasetMeta(0).data.forEach((bar, i) => {
      const value = chart.data.datasets[0].data[i] as number;
      const { x, y } = bar.getProps(["x", "y"], true);
      ctx.fillText(fmt(value), x + 6, y);
    });
    ctx.restore();
  },
};

function RankedBars(
  { rows, label }: { rows: [string, number][]; label: string },
) {
  const max = Math.max(1, ...rows.map(([, v]) => v));
  return (
    <div style={{ height: Math.max(120, rows.length * 30 + 24) }}>
      <Bar
        data={{
          labels: rows.map(([k]) => k),
          datasets: [
            {
              label,
              data: rows.map(([, v]) => v),
              backgroundColor: rows.map(([k]) =>
                / others$/.test(k) ? "#a1a1aa" : VIZ.bar
              ),
              borderRadius: 4,
              borderSkipped: "start",
              maxBarThickness: 20,
            },
          ],
        }}
        plugins={[endLabels]}
        options={{
          indexAxis: "y",
          maintainAspectRatio: false,
          layout: { padding: { right: 44 } },
          scales: {
            x: {
              display: false,
              beginAtZero: true,
              // Headroom so the longest bar's label stays inside the canvas.
              suggestedMax: max * 1.05,
            },
            y: {
              grid: { display: false },
              border: { display: false },
              ticks: { color: VIZ.textPrimary, font: { ...FONT, size: 12 } },
            },
          },
          plugins: {
            ...baseTooltip,
            legend: { display: false },
          },
        }}
      />
    </div>
  );
}

function RecentOrdersCard() {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white shadow-sm p-4">
      <DropDown className="flex flex-col gap-4 mt-4">
        {(isOpen) => [
          <button className="text-sm cursor-pointer flex items-center gap-2 w-fit font-semibold text-zinc-900">
            <span>Last 10 orders</span>
            {isOpen
              ? <ChevronUp className="size-4" />
              : <ChevronDown className="size-4" />}
          </button>,
          <RecentOrders />,
        ]}
      </DropDown>
    </section>
  );
}

const RecentOrders = () => {
  const orders = useOrders()
    .sort((o, o1) => o1.createdAt.getTime() - o.createdAt.getTime())
    .slice(0, 10);

  return (
    <Fragment>
      {orders.map((order) => (
        <OrderComponent key={order.getUniqueID} order={order} />
      ))}
    </Fragment>
  );
};

function BooksCard() {
  const [books, setBooks] = useState<
    Required<(Pick<IAgent, "books" | "id"> & { name: string })>[]
  >([]);
  const _loadBooksDistribution = useLoadBookDistribution();
  useEffect(() => {
    _loadBooksDistribution().then((data) => setBooks(data));
  }, []);

  return (
    <section className="flex flex-col gap-3 p-5 rounded-xl border border-zinc-200 bg-white shadow-sm">
      <Expanded>
        <h2 className="text-sm font-semibold text-zinc-900 mb-2">
          Agents & books
        </h2>
        <div className="divide-y divide-zinc-100">
          {books.map((bc) => (
            <div key={bc.id} className="flex flex-wrap items-center gap-2 py-2.5">
              <span className="font-medium text-sm mr-2">{bc.name}</span>
              {Object.entries(bc.books)
                .filter(([name, count]) => count > 0)
                .sort(([a], [b]) => a.charCodeAt(0) - b.charCodeAt(0))
                .sort(([a], [b]) =>
                  (a.includes("SSCE") ? 1 : a.includes("UTME") ? 2 : 0) -
                  (b.includes("SSCE") ? 1 : b.includes("UTME") ? 2 : 0)
                )
                .map(([name, count]) => (
                  <span
                    key={name}
                    className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs"
                  >
                    {name} <b className="tabular-nums">{count ?? 0}</b>
                  </span>
                ))}
            </div>
          ))}
        </div>
        {books.isEmpty() && (
          <div className="text-center text-sm text-zinc-400">No books</div>
        )}
      </Expanded>
    </section>
  );
}

const UserMetric = () => {
  const [agentCount, setAgentCount] = useState<number>();
  const [affiliateCount, setAffiliateCount] = useState<number>();

  useEffect(() => {
    new WithAuth(
      postgrest.from("agents").select("id", { count: "exact" }).limit(0),
    )
      .unwrap()
      .then(({ count: c }) => {
        setAgentCount(c ?? 0);
      });
    new WithAuth(
      postgrest.from("affiliates").select("id", { count: "exact" }).limit(0),
    )
      .unwrap()
      .then(({ count: c }) => {
        setAffiliateCount(c ?? 0);
      });
  }, []);

  return (
    <Fragment>
      <StatTile
        label="Agents"
        value={agentCount === undefined ? undefined : fmt(agentCount)}
      />
      <StatTile
        label="Affiliates"
        value={affiliateCount === undefined ? undefined : fmt(affiliateCount)}
      />
    </Fragment>
  );
};

import { Fragment, useEffect, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { postgrest, WithAuth } from "../../../src/utils/postgrest";
import { ChevronDown, ChevronUp } from "../../../src/components/Icons";
import { OrderComponent } from "../../../src/components/Order.component";
import DropDown from "../../../src/components/Dropdown";
import { useOrders } from "../../../src/services/orders.service/hook";
import { useLoadBookDistribution } from "../../../src/hooks/useLoadBookDistribution";
import {
  cummalativeOrderByState,
  cummalativeOrderForAffiliateByMonth,
} from "../../../src/utils/helper";
import { Line } from "react-chartjs-2";
import "chart.js/auto";
import {
  ArcElement,
  Chart,
  ChartDataset,
  Point,
  registerables,
  ScriptableLineSegmentContext,
} from "chart.js";
import Carbon from "../../../src/utils/carbon";
import Expanded from "../../../src/components/Expanded";

export default function () {
  const context = usePageContext();
  const [books, setBooks] = useState<
    Required<(Pick<IAgent, "books" | "id"> & { name: string })>[]
  >(
    [],
  );
  const _loadBooksDistribution = useLoadBookDistribution();
  useEffect(() => {
    _loadBooksDistribution().then((data) => setBooks(data));
  }, []);

  useEffect(() => {
    Chart.register(ArcElement, ...registerables);
  }, []);

  return (
    <div className="p-4 flex flex-col gap-4 overflow-y-scroll h-full">
      <div className="flex gap-4 rounded-lg px-12 w-fit shadow-lg py-3 text-xl text-zinc-700 font-bold">
        <span>Hello !!</span>
        <span>{context.config.user!.fullname}</span>
      </div>
      <div className="rounded-lg p-3 shadow-md">
        <DropDown className="flex flex-col gap-4">
          {(isOpen) => [
            <div className="text-xs cursor-pointer flex items-center gap-3 w-fit">
              <span className="font-semibold">Last 10 Orders</span>
              <span className="relative size-5">
                <ChevronDown
                  className={`absolute transition-all duration-300 ${
                    isOpen ? "opacity-0" : ""
                  }`}
                />
                <ChevronUp
                  className={`absolute transition-all duration-300 ${
                    !isOpen ? "opacity-0" : ""
                  }`}
                />
              </span>
            </div>,
            <RecentOrders />,
          ]}
        </DropDown>
      </div>
      <div className="flex flex-col gap-3 p-4 shadow-md rounded-lg">
        <Expanded>
          <div className="font-semibold text-center">Agents & Books</div>
          {books.map((bc) => (
            <div key={bc.id} className="flex flex-wrap gap-4 py-2 border-y-4">
              <span className="font-semibold underline">
                {bc.name}
              </span>
              {Object.entries(bc.books)
                .filter(([name, count]) =>
                  count > 0
                )
                .sort(([a], [b]) => a.charCodeAt(0) - b.charCodeAt(0))
                .sort(([a], [b]) =>
                  (a.includes("SSCE") ? 1 : a.includes("UTME") ? 2 : 0) -
                  (b.includes("SSCE") ? 1 : b.includes("UTME") ? 2 : 0)
                )
                .map(([name, count]) => (
                  <div key={name} className="text-sm">
                    {name} : {count ?? 0}
                  </div>
                ))}
            </div>
          ))}
          {books.isEmpty() && <div className="text-center">-- no books --</div>}
        </Expanded>
      </div>
      <UserMetric />
      <OrderMetricBySource />
      <OrderMetricByState />
    </div>
  );
}

const RecentOrders = () => {
  const orders = useOrders()
    .sort((o, o1) => o1.createdAt.getTime() - o.createdAt.getTime())
    .slice(0, 10);

  return (
    <Fragment>
      {orders.map((order) => <OrderComponent key={order.ID} order={order} />)}
    </Fragment>
  );
};

const UserMetric = () => {
  const [agentCount, setAgentCount] = useState(0);
  const [affiliateCount, setAffiliateCount] = useState(0);

  useEffect(() => {
    new WithAuth(
      postgrest.from("agents").select("id", { count: "exact" }).limit(0),
    )
      .unwrap()
      .then(({ count: c }) => {
        setAgentCount(c!);
      });
    new WithAuth(
      postgrest.from("affiliates").select("id", { count: "exact" }).limit(0),
    )
      .unwrap()
      .then(({ count: c }) => {
        setAffiliateCount(c!);
      });
  }, []);

  return (
    <div className="flex gap-8 items-center text-sm">
      <div>
        <span>Agents:</span> <span className="font-semibold">{agentCount}</span>
      </div>

      <div>
        <span>Affiliates:</span>{" "}
        <span className="font-semibold">{affiliateCount}</span>
      </div>
    </div>
  );
};

const OrderMetricBySource = () => {
  const [metric, setMetric] = useState<
    ChartDataset<"line", (number | Point | null)[]>[]
  >([]);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    cummalativeOrderForAffiliateByMonth(year).then((data) =>
      setMetric(getData(data))
    );
  }, [year]);

  const skipped = (ctx: ScriptableLineSegmentContext, value: any) =>
    ctx.p0.skip || ctx.p1.skip ? value : undefined;
  const getData = (
    data: Awaited<ReturnType<typeof cummalativeOrderForAffiliateByMonth>>,
  ): ChartDataset<"line", (number | Point | null)[]>[] => {
    let result: ChartDataset<"line", (number | Point | null)[]>[] = [];

    for (const key in data) {
      let r: (typeof result)[number] = {
        label: key,
        data: Object.values(data[key]).map((v, index, arr) =>
          v.order_count == 0 && index != 0 && index != arr.length - 1
            ? NaN
            : v.order_count
        ),
        segment: {
          borderColor: (ctx) => skipped(ctx, "rgb(0,0,0,0.2)"),
          borderDash: (ctx) => skipped(ctx, [6, 6]),
        },
        spanGaps: true,
      };
      result = result.concat(r);
    }

    return result;
  };

  return (
    <div className="shadow-md rounded-lg px-4">
      <div className="flex justify-end text-sm">
        <select
          defaultValue={year}
          onChange={(ev) => setYear(parseInt(ev.currentTarget.value))}
          className="outline-none"
        >
          {Array.from(Array(new Carbon().getFullYear() - 2024 + 1).keys()).map(
            (k) => (
              <option
                key={new Carbon().getFullYear() - k}
                value={new Carbon().getFullYear() - k}
              >
                {new Carbon().getFullYear() - k}
              </option>
            ),
          )}
        </select>
      </div>
      <Line
        options={{
          plugins: {
            title: {
              display: true,
              font: { size: 16, weight: "bold" },
              text: `Total orders: ${
                metric
                  .map((v) =>
                    v.data.map((val) => (isNaN(val as number) ? 0 : val))
                  )
                  .flat()
                  .sum()
              }`,
            },
          },
        }}
        data={{
          labels: Array.from(Array(Carbon.lastMonthOfYear(year)).keys()).map(
            (month) =>
              Carbon.fromYear(year ?? new Date().getFullYear(), month).month,
          ),
          datasets: metric,
        }}
      />
    </div>
  );
};

const OrderMetricByState = () => {
  const [metric, setMetric] = useState<
    ChartDataset<"line", (number | Point | null)[]>[]
  >([]);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    cummalativeOrderByState(year).then((data) => setMetric(getData(data)));
  }, [year]);

  const skipped = (ctx: ScriptableLineSegmentContext, value: any) =>
    ctx.p0.skip || ctx.p1.skip ? value : undefined;

  const getData = (
    data: Awaited<ReturnType<typeof cummalativeOrderByState>>,
  ): ChartDataset<"line", (number | Point | null)[]>[] => {
    let result: ChartDataset<"line", (number | Point | null)[]>[] = [];

    for (const key in data) {
      let r: (typeof result)[number] = {
        label: key,
        data: Object.values(data[key]).map((v, index, arr) =>
          v.order_count == 0 && index != 0 && index != arr.length - 1
            ? NaN
            : v.order_count
        ),
        segment: {
          borderColor: (ctx) => skipped(ctx, "rgb(0,0,0,0.2)"),
          borderDash: (ctx) => skipped(ctx, [6, 6]),
        },
        spanGaps: true,
      };
      result = result.concat(r);
    }

    return result;
  };

  return (
    <div className="shadow-md rounded-lg px-4">
      <div className="flex justify-end text-sm">
        <select
          defaultValue={year}
          onChange={(ev) => setYear(parseInt(ev.currentTarget.value))}
          className="outline-none"
        >
          {Array.from(Array(new Carbon().getFullYear() - 2024 + 1).keys()).map(
            (k) => (
              <option
                key={new Carbon().getFullYear() - k}
                value={new Carbon().getFullYear() - k}
              >
                {new Carbon().getFullYear() - k}
              </option>
            ),
          )}
        </select>
      </div>
      <Line
        options={{
          plugins: {
            title: {
              display: true,
              font: { size: 16, weight: "bold" },
              text: `Orders by State`,
            },
          },
        }}
        data={{
          labels: Array.from(Array(Carbon.lastMonthOfYear(year)).keys()).map(
            (month) =>
              Carbon.fromYear(year ?? new Date().getFullYear(), month).month,
          ),
          datasets: metric,
        }}
      />
    </div>
  );
};

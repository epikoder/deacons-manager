import { useData } from "vike-react/useData";
import { useObserver } from "../../../../../@types/observable";
import { CopyIcon, PhoneIcon } from "../../../../../components/Icons";
import { useEffect, useRef, useState } from "react";
import { Bar } from "react-chartjs-2";
import "chart.js/auto";
import { ArcElement, Chart, registerables } from "chart.js";
import { postgrest, WithAuth } from "../../../../../utils/postgrest";
import Carbon, { Month } from "../../../../../utils/carbon";
import { Affiliate } from "../../../../../services/affiliate.service";
import { SelectMonth } from "../../../../../components/Select";

export default function () {
  const { affiliate } = useData<{ affiliate?: Affiliate }>();
  if (!affiliate) return <>NOT FOUND</>;

  const [dayStats, setDayStats] = useState<DayStats[]>([]);
  const [monthStats, setMonthStats] = useState<MonthStats[]>([]);
  const [month, setMonth] = useState<Month>(new Carbon().getMonth());
  const [year, setYear] = useState<number>(new Carbon().getFullYear());
  useObserver(affiliate);

  useEffect(() => {
    Chart.register(ArcElement, ...registerables);
  }, []);

  const _loadDayStats = async () => {
    const res1 = await new WithAuth(
      postgrest.rpc("get_orders_by_day", {
        month: month + 1,
        year: new Carbon().getFullYear(),
        agent: null,
        source_filter: affiliate.source,
      }),
    ).unwrap();
    const _daystats = Array.from(
      Array(
        new Carbon().getMonth() == month
          ? new Carbon().getDate()
          : Carbon.fromMonth(month, 0).getDate(),
      ).keys(),
    ).map((day): DayStats => {
      const date = Carbon.fromMonth(month, day + 1).format();
      const stat = {
        day: date,
        delivered_count: 0,
        order_count: 0,
        pending_count: 0,
        ...((res1.data ?? []) as DayStats[]).find((v) => v.day == date),
      };
      return stat;
    });
    setDayStats(_daystats);
  };
  useEffect(() => {
    _loadDayStats();
  }, [month]);

  const _loadMonthStats = async () => {
    const res2 = await new WithAuth(
      postgrest.rpc("get_orders_by_month", {
        year: year,
        agent: null,
        source_filter: affiliate.source,
      }),
    ).unwrap();
    const _monthstats = Array.from(
      Array(
        year == new Date().getFullYear() ? new Carbon().getMonth() + 1 : 11,
      ).keys(),
    ).map((month): MonthStats => {
      const date = Carbon.fromYear(year, month).format();
      const stat = {
        month: date,
        delivered_count: 0,
        order_count: 0,
        pending_count: 0,
        ...((res2.data ?? []) as MonthStats[]).find((v) => v.month == date),
      };
      return stat;
    });
    setMonthStats(_monthstats);
  };
  useEffect(() => {
    _loadMonthStats();
  }, [year]);

  return (
    <div className="overflow-y-scroll flex flex-col gap-4 h-full p-4">
      <div className="p-4 shadow-md rounded-lg flex flex-col gap-3">
        <div className="flex justify-between">
          <div className="font-semibold text-2xl">{affiliate.name}</div>
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-3">
              <a
                className="flex gap-2 w-fit items-center"
                href={`tel:${affiliate.phone}`}
              >
                <PhoneIcon className="size-3 text-blue-500" />
                <div>{affiliate.phone}</div>
              </a>
              <button
                className="px-1"
                onClick={() => {
                  navigator.clipboard.writeText(affiliate.phone);
                  alert("copied!!");
                }}
              >
                <CopyIcon className="size-4" />
              </button>
            </div>
            <div className="font-semibold">{affiliate.email}</div>
          </div>
        </div>
        <Earning affiliate={affiliate} />
      </div>

      <div className="flex flex-col gap-8">
        <div className="shadow-md rounded-lg px-4">
          <div className="flex justify-end text-sm">
            <SelectMonth
              defaultValue={month}
              onChange={(ev) => setMonth(parseInt(ev.currentTarget.value))}
            />
          </div>
          <Bar
            className="max-h-96"
            options={{
              plugins: {
                title: {
                  display: true,
                  font: { size: 16, weight: "bold" },
                  text: `Orders for ${Carbon.monthString(month)}: ${
                    dayStats.map((v) => v.order_count).sum()
                  }`,
                },
                subtitle: {
                  display: true,
                  font: { size: 14, weight: "bold" },
                  text: `pending: ${
                    dayStats.map((v) => v.pending_count).sum()
                  } / Delivered: ${
                    dayStats.map((v) => v.delivered_count).sum()
                  }`,
                },
              },
              scales: {
                x: {
                  stacked: true,
                },
                y: {
                  stacked: true,
                },
              },
            }}
            data={{
              labels: dayStats.map((v) =>
                new Carbon(v.day)
                  .toDateString()
                  .split(" ")
                  .slice(0, 3)
                  .join(" ")
              ),
              datasets: [
                {
                  label: "Pending",
                  data: dayStats.map((v) => v.pending_count),
                },
                {
                  label: "Delivered",
                  data: dayStats.map((v) => v.delivered_count),
                },
              ],
            }}
          />
        </div>

        <div className="shadow-md rounded-lg px-4">
          <div className="flex justify-end text-sm">
            <select
              defaultValue={year}
              onChange={(ev) => setYear(parseInt(ev.currentTarget.value))}
              className="outline-none"
            >
              {Array.from(
                Array(new Carbon().getFullYear() - 2024 + 1).keys(),
              ).map((k) => (
                <option
                  key={new Carbon().getFullYear() - k}
                  value={new Carbon().getFullYear() - k}
                >
                  {new Carbon().getFullYear() - k}
                </option>
              ))}
            </select>
          </div>

          <Bar
            className="max-h-96"
            options={{
              plugins: {
                title: {
                  display: true,
                  font: { size: 16, weight: "bold" },
                  text: `Orders for ${"2024"}: ${
                    monthStats.map((v) => v.order_count).sum()
                  }`,
                },
                subtitle: {
                  display: true,
                  font: { size: 14, weight: "bold" },
                  text: `pending: ${
                    monthStats.map((v) => v.pending_count).sum()
                  } / Delivered: ${
                    monthStats.map((v) => v.delivered_count).sum()
                  }`,
                },
              },
              scales: {
                x: {
                  stacked: true,
                },
                y: {
                  stacked: true,
                },
              },
            }}
            data={{
              labels: monthStats.map((v) => new Carbon(v.month).month),
              datasets: [
                {
                  label: "Pending",
                  data: monthStats.map((v) => v.pending_count),
                },
                {
                  label: "Delivered",
                  data: monthStats.map((v) => v.delivered_count),
                },
              ],
            }}
          />
        </div>
      </div>
    </div>
  );
}

const Earning = ({ affiliate }: { affiliate: Affiliate }) => {
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    affiliate.Balance().fetchEarningForYear(year);
  }, [year]);

  return (
    <div className="flex justify-between items-end">
      <div className="text-zinc-600 flex flex-col gap-1">
        <select
          defaultValue={year}
          onChange={(ev) => setYear(parseInt(ev.currentTarget.value))}
          className="outline-none text-xs w-fit"
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
        <div>
          <span className="font-semibold text-2xl">
            {affiliate.balance[0].asLocalCurrency()}
          </span>
          &nbsp;
          <span className="text-xs">{new Carbon().month}</span>
          &nbsp;
          <span>/</span>
          &nbsp;
          <span>{affiliate.balance[1].asLocalCurrency()}</span>
          &nbsp;
          <span className="text-xs">total</span>
        </div>
      </div>

      <a href={`/affiliates/report/${affiliate.ID}`}>
        <div className="text-center text-white bg-cyan-500 text-xs rounded-lg whitespace-nowrap px-4 py-1 hover:bg-opacity-75 w-fit">
          View Report
        </div>
      </a>
    </div>
  );
};

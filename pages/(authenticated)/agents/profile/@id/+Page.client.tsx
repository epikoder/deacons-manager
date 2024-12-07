import { useData } from "vike-react/useData";
import { Agent } from "../../../../../services/agents.service";
import { useObserver } from "../../../../../@types/observable";
import {
  ChevronDown,
  ChevronUp,
  CopyIcon,
  PhoneIcon,
} from "../../../../../components/Icons";
import { Fragment, useEffect, useRef, useState } from "react";
import { Bar } from "react-chartjs-2";
import "chart.js/auto";
import { ArcElement, Chart, registerables } from "chart.js";
import { postgrest, WithAuth } from "../../../../../utils/postgrest";
import Carbon, { Month } from "../../../../../utils/carbon";
import { SelectMonth, SubjectSelect } from "../../../../../components/Select";
import Button from "../../../../../components/Button";
import { showAlertDialog } from "../../../../../components/Dialog";
import DropDown from "../../../../../components/Dropdown";
import { useOrders } from "../../../../../services/orders.service/hook";
import { OrderComponent } from "../../../../../components/Order.component";

export default function () {
  const { agent } = useData<{ agent?: Agent }>();
  if (!agent) return <>NOT FOUND</>;
  const [dayStats, setDayStats] = useState<DayStats[]>([]);
  const [monthStats, setMonthStats] = useState<MonthStats[]>([]);
  const [month, setMonth] = useState<Month>(new Carbon().getMonth());
  const [year, setYear] = useState<number>(new Carbon().getFullYear());
  useObserver(agent);

  useEffect(() => {
    Chart.register(ArcElement, ...registerables);
  }, []);

  const _loadDayStats = async () => {
    const res1 = await new WithAuth(
      postgrest.rpc("get_orders_by_day", {
        month: month + 1,
        year: new Carbon().getFullYear(),
        agent: agent.ID,
        source_filter: null,
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
        agent: agent.ID,
        source_filter: null,
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
          <div className="font-semibold text-2xl">{agent.name}</div>
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-3">
              <a
                className="flex gap-2 w-fit items-center"
                href={`tel:${agent.phone}`}
              >
                <PhoneIcon className="size-3 text-blue-500" />
                <div>{agent.phone}</div>
              </a>
              <button
                className="px-1"
                onClick={() => {
                  navigator.clipboard.writeText(agent.phone);
                  alert("copied!!");
                }}
              >
                <CopyIcon className="size-4" />
              </button>
            </div>
            <div className="font-semibold">{agent.state}</div>
          </div>
        </div>
        <div className="flex justify-between items-end w-full">
          <Earning agent={agent} />
          <div className="flex gap-2 items-center">
            <a href={`/agents/orders/${agent.ID}`}>
              <div className="text-center text-white bg-blue-500 text-xs rounded-lg whitespace-nowrap px-4 py-1 hover:bg-opacity-75 w-fit">
                View Orders
              </div>
            </a>
            <a href={`/agents/report/${agent.ID}`}>
              <div className="text-center text-white bg-cyan-500 text-xs rounded-lg whitespace-nowrap px-4 py-1 hover:bg-opacity-75 w-fit">
                View Report
              </div>
            </a>
          </div>
        </div>
      </div>

      <div className="rounded-lg p-3 shadow-md">
        <RecentOrders id={agent.ID} />
      </div>

      <div className="flex flex-col gap-3 p-4 shadow-md rounded-lg">
        <div className="font-semibold">Books currently holding</div>
        <div className="flex flex-wrap gap-4">
          {Object.entries(agent.books)
            .filter(([_, count]) => count > 0)
            .sort(([a], [b]) => a.charCodeAt(0) - b.charCodeAt(0))
            .map(([name, count]) => (
              <div key={name} className="text-sm">
                {name} : {count}
              </div>
            ))}
        </div>
        {Object.entries(agent.books).filter(([_, count]) => count > 0)
          .isEmpty() && <div className="text-center">-- no books --</div>}
        <AssignAgentBooks agent={agent} />
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

const Earning = ({ agent }: { agent: Agent }) => {
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    agent.Balance().fetchEarningForYear(year);
  }, [year]);

  return (
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
          {agent.balance[0].asLocalCurrency()}
        </span>
        &nbsp;
        <span className="text-xs">{new Carbon().month}</span>
        &nbsp;
        <span>/</span>
        &nbsp;
        <span>{agent.balance[1].asLocalCurrency()}</span>
        &nbsp;
        <span className="text-xs">total</span>
      </div>
    </div>
  );
};

const AssignAgentBooks = ({ agent }: { agent: Agent }) => {
  const ref = useRef<{ getItems: () => BookConfig }>();

  return (
    <Button
      className="bg-green-500 w-fit px-8 mx-auto"
      onClick={() => {
        showAlertDialog({
          title: "Assign Books",
          message: (
            <div>
              <SubjectSelect ref={ref} defaultValue={agent.books} />
            </div>
          ),
          onContinue: () => agent.updateBooks(ref.current!.getItems()),
        });
      }}
    >
      Update Books
    </Button>
  );
};

const RecentOrders = ({ id }: { id: string }) => {
  const orders = useOrders(1, {
    limit: 100,
    agent_id: id,
    delivery_status: "pending",
  })
    .sort((o, o1) => o1.createdAt.getTime() - o.createdAt.getTime())
    .slice(0, 10);

  return (
    <DropDown className="flex flex-col gap-4">
      {(isOpen) => [
        <div className="text-xs cursor-pointer flex items-center gap-3 w-fit">
          <span className="font-semibold">
            Pending orders -- {orders.length}
          </span>
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
        <Fragment>
          {orders.map((order) => (
            <OrderComponent
              key={order.ID}
              order={order}
            />
          ))}
        </Fragment>,
      ]}
    </DropDown>
  );
};

import { useState } from "react";
import { StackedOrdersChart } from "./charts";
import { Card, fmtCount, selectClass } from "./ui";
import {
  MONTH_NAMES,
  StackedSeries,
  useOrderStats,
  yearOptions,
} from "../hooks/useOrderStats";

const total = (s: StackedSeries) =>
  s.delivered.reduce((a, b) => a + b, 0) + s.pending.reduce((a, b) => a + b, 0);
const delivered = (s: StackedSeries) => s.delivered.reduce((a, b) => a + b, 0);

/**
 * Daily orders for one month and monthly orders for one year, for an agent or an
 * affiliate's sources. The year picker drives both charts, so they never disagree.
 */
export default function OrderStatsCharts(
  { agent, sources, year, onYearChange }: {
    agent?: string;
    sources?: string[];
    year: number;
    onYearChange: (y: number) => void;
  },
) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const { daily, monthly } = useOrderStats({ agent, sources }, year, month);
  const lastMonth = year === now.getFullYear() ? now.getMonth() : 11;
  const shownMonth = Math.min(month, lastMonth);

  const summary = (s: StackedSeries | null) =>
    s
      ? `${fmtCount(total(s))} orders · ${fmtCount(delivered(s))} delivered`
      : "Loading…";

  return (
    <div className="flex flex-col gap-5">
      <Card
        title={`Orders in ${MONTH_NAMES[shownMonth]} ${year}`}
        description={summary(daily)}
        actions={
          <select
            aria-label="Month"
            value={shownMonth}
            onChange={(ev) => setMonth(parseInt(ev.currentTarget.value))}
            className={selectClass}
          >
            {MONTH_NAMES.slice(0, lastMonth + 1).map((m, i) => (
              <option key={m} value={i}>{m}</option>
            ))}
          </select>
        }
      >
        {daily
          ? <StackedOrdersChart {...daily} height="h-64" />
          : <div className="h-64 animate-pulse rounded-lg bg-zinc-100" />}
      </Card>
      <Card
        title={`Orders per month · ${year}`}
        description={summary(monthly)}
        actions={
          <select
            aria-label="Year"
            value={year}
            onChange={(ev) => onYearChange(parseInt(ev.currentTarget.value))}
            className={selectClass}
          >
            {yearOptions().map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        }
      >
        {monthly
          ? <StackedOrdersChart {...monthly} height="h-64" />
          : <div className="h-64 animate-pulse rounded-lg bg-zinc-100" />}
      </Card>
    </div>
  );
}

import { useEffect, useState } from "react";
import { postgrest, WithAuth } from "../utils/postgrest";

export interface StackedSeries {
  labels: string[];
  delivered: number[];
  pending: number[];
}

type Row = { order_count: number; delivered_count: number };

const pad = (n: number) => String(n).padStart(2, "0");
const MONTHS_SHORT = [
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

/**
 * Orders per day of one month and per month of one year, for an agent or for a set of
 * affiliate sources, split into delivered and pending.
 *
 * Replaces per-page code that took the month length from the previous month, always
 * used the current year for the daily chart, and stopped past years at November.
 */
export function useOrderStats(
  { agent, sources }: { agent?: string | null; sources?: string[] | null },
  year: number,
  month: number, // 0-11
) {
  const [daily, setDaily] = useState<StackedSeries | null>(null);
  const [monthly, setMonthly] = useState<StackedSeries | null>(null);
  const filter = {
    agent: agent ?? null,
    source_filter: sources && sources.length ? sources : null,
  };
  const key = JSON.stringify(filter);
  // An affiliate with no sources owns no orders. A null source_filter means "no
  // filter" to the RPC, which would chart every order in the system.
  const owns = !(Array.isArray(sources) && sources.length === 0);
  const empty = () => Promise.resolve({ data: [] as unknown[] });

  useEffect(() => {
    let live = true;
    setDaily(null);
    const now = new Date();
    const isThisMonth = year === now.getFullYear() && month === now.getMonth();
    const inFuture = year > now.getFullYear() ||
      (year === now.getFullYear() && month > now.getMonth());
    const days = inFuture
      ? 0
      : isThisMonth
      ? now.getDate()
      : new Date(year, month + 1, 0).getDate();

    (owns
      ? new WithAuth(
        postgrest.rpc("get_orders_by_day", { month: month + 1, year, ...filter }),
      ).unwrap()
      : empty()).then(({ data }) => {
      if (!live) return;
      const byDay = new Map<string, Row>();
      for (const r of (data ?? []) as (Row & { day: string })[]) {
        byDay.set(String(r.day).slice(0, 10), r);
      }
      const series: StackedSeries = { labels: [], delivered: [], pending: [] };
      for (let d = 1; d <= days; d++) {
        const r = byDay.get(`${year}-${pad(month + 1)}-${pad(d)}`);
        series.labels.push(`${d} ${MONTHS_SHORT[month]}`);
        series.delivered.push(Number(r?.delivered_count ?? 0));
        series.pending.push(
          Number(r?.order_count ?? 0) - Number(r?.delivered_count ?? 0),
        );
      }
      setDaily(series);
    });
    return () => {
      live = false;
    };
  }, [key, year, month]);

  useEffect(() => {
    let live = true;
    setMonthly(null);
    const now = new Date();
    const months = year === now.getFullYear()
      ? now.getMonth() + 1
      : year > now.getFullYear()
      ? 0
      : 12;

    (owns
      ? new WithAuth(
        postgrest.rpc("get_orders_by_month", { year, ...filter }),
      ).unwrap()
      : empty()).then(({ data }) => {
      if (!live) return;
      const byMonth = new Map<string, Row>();
      for (const r of (data ?? []) as (Row & { month: string })[]) {
        byMonth.set(String(r.month).slice(0, 7), r);
      }
      const series: StackedSeries = { labels: [], delivered: [], pending: [] };
      for (let m = 0; m < months; m++) {
        const r = byMonth.get(`${year}-${pad(m + 1)}`);
        series.labels.push(MONTHS_SHORT[m]);
        series.delivered.push(Number(r?.delivered_count ?? 0));
        series.pending.push(
          Number(r?.order_count ?? 0) - Number(r?.delivered_count ?? 0),
        );
      }
      setMonthly(series);
    });
    return () => {
      live = false;
    };
  }, [key, year]);

  return { daily, monthly };
}

export const yearOptions = () => {
  const now = new Date().getFullYear();
  return Array.from({ length: now - 2024 + 1 }, (_, i) => now - i);
};

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

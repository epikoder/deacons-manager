import Carbon from "./carbon";
import { postgrest, WithAuth } from "./postgrest";

export {
	cummalativeOrderByState,
	cummalativeOrderForAffiliateByMonth,
	formatQuery,
};

const formatQuery = <T = Primitive>(
	url: string,
	params: T | undefined,
): string => {
	if (!params) return encodeURI(url);
	let query = "";
	for (const k in params) {
		if (typeof params[k] === "undefined" || params[k] == null) continue;
		if (typeof params[k] === "object") {
			for (const v of Object.values(params[k]!)) {
				query += `&${k}=${v}`;
			}
		} else {
			query += `&${k}=${
				typeof params[k] === "boolean" ? (params[k] ? 1 : 0) : params[k]
			}`;
		}
	}
	query = encodeURI(`${url}?${query}`);
	return query;
};

const cummalativeOrderForAffiliateByMonth = async (year?: number) => {
	const { data } = (await new WithAuth(
		postgrest.rpc("cummulative_orders_for_affiliate_by_month", {
			year: year ?? new Date().getFullYear(),
		}),
	).unwrap()) as { data: any[] };
	const result: Record<string, Record<string, Omit<MonthStats, "month">>> = {};
	for (const stat of data ?? []) {
		const ms = result[stat.source] ?? {};
		if (Object.values(ms).isEmpty()) {
			Array.from(Array(Carbon.lastMonthOfYear(year)).keys())
				.map((month) =>
					Carbon.fromYear(
						year ?? new Date().getFullYear(),
						month,
					).formatLocalISO(),
				)
				.forEach(
					(month) =>
						(ms[month] = {
							delivered_count: 0,
							order_count: 0,
							pending_count: 0,
						}),
				);
		}

		ms[stat.month] = {
			delivered_count: stat.delivered_count,
			order_count: stat.order_count,
			pending_count: stat.pending_count,
		};
		result[stat.source] = ms;
	}
	return result;
};

const cummalativeOrderByState = async (year?: number) => {
	const { data } = await new WithAuth(
		postgrest.rpc("cummulative_orders_by_state", {
			year: year ?? new Date().getFullYear(),
		}),
	).unwrap();
	const result: Record<string, Record<string, Omit<MonthStats, "month">>> = {};
	for (const stat of data ?? []) {
		const ms = result[stat.state] ?? {};
		if (Object.values(ms).isEmpty()) {
			Array.from(Array(12).keys())
				.map((month) =>
					Carbon.fromYear(
						year ?? new Date().getFullYear(),
						month,
					).formatLocalISO(),
				)
				.forEach(
					(month) =>
						(ms[month] = {
							delivered_count: 0,
							order_count: 0,
							pending_count: 0,
						}),
				);
		}

		ms[stat.month] = {
			delivered_count: stat.delivered_count,
			order_count: stat.order_count,
			pending_count: stat.pending_count,
		};
		result[stat.state] = ms;
	}
	return result;
};

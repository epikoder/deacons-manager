import { SubscriberProvider } from "../../../@types/subscribers";
import Bucket from "../../utils/bucket";
import Carbon from "../../utils/carbon";
import { PG_UNAUTHORIZED } from "../../utils/constants";
import { normalizePhoneQuery } from "../../utils/phone";
import { postgrest, WithAuth } from "../../utils/postgrest";
import Toast from "../../utils/toast";
import Order, { OFFICE_CHARGE, OrderItem } from "./order";
import { searchClauses, SearchScope } from "./search";

type AwaitedOrderWithSource = Promise<IOrder[]>;
type SourceTimeStamp = Record<string, Carbon>;
export type SortDirection = "asc" | "desc";
export type FetchOrdersParam = Omit<SearchParam, "offset"> & {
  confirmed?: boolean;
  assigned?: boolean;
  delivery_status?: DeliveryStatus;
  source?: string[];
  category?: string[];
  agent_id?: string;
  phone?: string;
  search?: string;
  /** Which field `search` looks in; "all" (the default) tries each of them. */
  searchIn?: SearchScope;
  /** false (the default) hides archived orders, true shows only them. */
  archived?: boolean;
  /** By created_at, or delivered_on when filtering on delivered. */
  sort?: SortDirection;
};

const defaulSearchParam: Readonly<SearchParam> = {
  limit: 50,
  offset: 0,
};

const sourceAsID = (s: string) => {
  return s
    .toLowerCase()
    .trim()
    .replace(/^(\s|\s+)/g, "-");
};

class OrderServiceNotification extends SubscriberProvider {
  notify() {
    this.notifySubscribers(undefined);
  }
}

export default class OrderService extends SubscriberProvider<Order[]> {
  private _fetchInterval: number = 60000; // sec
  private _sources: Map<string, [string, OrderSource]> = new Map();
  private _orders: Bucket<Order> = new Bucket<Order>((order: Order) =>
    order.getUniqueID
  );
  private static _instance = new OrderService();
  private _fetchParam: SearchParam = defaulSearchParam;
  private _lastRefreshTimeStamp: SourceTimeStamp = {};
  private _totalOrders = 0;
  private _loading = false;
  private _costPerBook = 1200;
  private _timeout?: ReturnType<typeof setTimeout>;
  public notification: OrderServiceNotification =
    new OrderServiceNotification();

  get lastRefreshTimeStamp(): SourceTimeStamp {
    return this._lastRefreshTimeStamp;
  }

  get sourceList(): string[] {
    return [...this._sources.keys()];
  }

  get sources(): [string, string][] {
    return [...this._sources.entries()].map(([name, [uri, _]]) => [name, uri]);
  }

  get orders() {
    return this._orders.items;
  }

  get totalOrders() {
    return this._totalOrders;
  }

  get loading() {
    return this._loading;
  }

  get bucket(): Bucket<Order> {
    return this._orders;
  }

  public get costPerBook() {
    return this._costPerBook;
  }

  public set costPerBook(v: number) {
    this._costPerBook = v;
  }

  async init() {
    const { data, error } = await new WithAuth(
      postgrest.from("configs").select().eq("name", "timestamp").single(),
    ).unwrap();

    if (!error) {
      Object.entries(data["value"]).forEach(([key, timestamp]) => {
        data["value"][key] = timestamp
          ? new Carbon(timestamp as string)
          : new Carbon("2024-12-01");
      });
      this._lastRefreshTimeStamp = data["value"]
        ? {
          ...this._lastRefreshTimeStamp,
          ...data["value"],
        }
        : this._lastRefreshTimeStamp;
    }
    return OrderService._instance;
  }

  static get instance() {
    return OrderService._instance;
  }

  /**
   * @param interval in seconds
   */
  public setFetchInterval(interval: number) {
    this._fetchInterval = interval * 1000;
  }

  public start() {
    this.fetchOrderFromSource().then(() => {
      this.backgroundRefresh();
    });
  }

  public stopBackgroundPull() {
    this._timeout && clearTimeout(this._timeout);
  }

  private async backgroundRefresh() {
    this._timeout = setTimeout(async () => {
      await this.fetchOrderFromSource();
      this.backgroundRefresh();
    }, this._fetchInterval);
  }

  private async updateLastTimeStamp() {
    await new WithAuth(
      postgrest
        .from("configs")
        .upsert({ name: "timestamp", value: this._lastRefreshTimeStamp })
        .eq("name", "timestamp"),
    ).unwrap();
  }

  public setSearchParam(param?: SearchParam) {
    this._fetchParam = param ?? defaulSearchParam;
  }

  private sourceSearchParam(source: string) {
    const param = { ...defaulSearchParam, ...this._fetchParam };
    return {
      ...param,
      start_date: this.lastRefreshTimeStamp[sourceAsID(source)]
        ? this.lastRefreshTimeStamp[sourceAsID(source)].format()
        : undefined,
      end_date: undefined,
    } satisfies SearchParam;
  }

  private async fetchOrderFromSource() {
    const arr = [...this._sources.entries()];
    let promises: AwaitedOrderWithSource[] = [];
    for (const [source, [_, fn]] of arr) {
      promises = promises.concat(
        (async (param: SearchParam) => {
          try {
            let result = await fn(param);
            return result.map((order) => ({
              ...order,
              source: source,
            }));
          } catch (error) {
            console.error(error);
            return [];
          }
        })(this.sourceSearchParam(source)),
      );
    }

    const res = await Promise.all(promises);

    let inserted = 0;
    for (const orders of res) {
      const o = orders.at(0);
      if (!o) continue;
      inserted += await this.saveSourceOrders(orders);
      this.lastRefreshTimeStamp[sourceAsID(o.source)] = new Carbon();
    }
    this.updateLastTimeStamp();
    if (inserted > 0) {
      this.notification.notify();
      // New orders used to be pushed straight into whatever list was on screen, so a
      // search or a filtered page grew rows that did not match it. Re-run the query
      // that is showing instead; the database decides what belongs.
      this.refresh();
    }
  }

  /**
   * One insert per source rather than one upsert per order. The pull window overlaps
   * the previous one, so most rows already exist: those are skipped, which also keeps
   * a re-pull from touching an order an admin has since confirmed or archived.
   */
  private async saveSourceOrders(orders: IOrder[]): Promise<number> {
    const rows = orders.map((o) => ({
      ...o,
      delivery_status: o.delivery_status ?? "pending",
      office_charge: o.office_charge ?? o.order_amount * OFFICE_CHARGE,
    }));
    const { data, error } = await new WithAuth(
      postgrest
        .from("orders")
        .upsert(rows, { onConflict: "source,id", ignoreDuplicates: true })
        .select("_id"),
    ).unwrap();
    if (error) {
      console.error(`saving ${orders[0]?.source} orders failed`, error);
      return 0;
    }
    return (data as unknown[] | null)?.length ?? 0;
  }

  public registerSource(
    name: string,
    source: OrderSource,
    uri: string,
    date?: Carbon,
  ) {
    this._sources.set(name, [uri, source]);
    date = date ?? new Carbon("2024-12-01");
    this._lastRefreshTimeStamp[sourceAsID(name)] = date;

    /// remove orders before registered date
    new WithAuth(
      postgrest.from("orders").delete().lt("created_at", date.formatLocalISO())
        .eq("source", name),
    ).unwrap();
    this.notifySubscribers(this.orders);
  }

  _abortController: AbortController | undefined;
  private _lastFetch?: { page: number; param: FetchOrdersParam };

  /**
   * Re-run whatever query is on screen, without the full-page spinner. Called after a
   * confirm / assign / archive so the row leaves a list it no longer matches, the
   * totals and pages are recounted, and the next order moves up into the gap.
   */
  public refresh() {
    if (!this._lastFetch) return Promise.resolve();
    return this.fetchOrders(this._lastFetch.page, this._lastFetch.param, {
      silent: true,
    });
  }

  public async fetchOrders(
    page = 1,
    param: FetchOrdersParam = {
      limit: 50,
    },
    { silent = false }: { silent?: boolean } = {},
  ) {
    this._lastFetch = { page, param };
    // A silent refresh keeps the current rows up until the new ones arrive (and leaves
    // a spinner that is already showing for a fetch it supersedes).
    if (!silent) this._loading = true;
    if (this._abortController) {
      this._abortController.abort();
    }
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    this.notifySubscribers(this.orders);

    try {
      await this.queryOrders(page, param, signal);
    } catch (error) {
      // Anything thrown used to leave _loading set for good: the spinner never cleared
      // and nothing said why.
      if (signal.aborted) return;
      console.error("orders query failed", error);
      Toast.error("Couldn't load orders. Check your connection and try again.");
      this._loading = false;
      this.notifySubscribers(this.orders);
    }
  }

  private async queryOrders(
    page: number,
    param: FetchOrdersParam,
    signal: AbortSignal,
  ) {

    // range() is inclusive on both ends. The page size used to be a hardcoded 50 for
    // the offset but param.limit for the end, so page 1 held 50 rows, page 2 asked for
    // rows 50..150 (101 of them), and Pagination - which counts pages of param.limit -
    // disagreed with both.
    const limit = param.limit > 0 ? param.limit : 50;
    const offset = (Math.max(page, 1) - 1) * limit;

    const ascending = param.sort === "asc";
    let query = postgrest
      .from("orders")
      .select(`*,agents(*)`, { count: "exact" });
    query = param.delivery_status === "delivered"
      ? query.order("delivered_on", { ascending, nullsFirst: false })
      : query.order("created_at", { ascending });
    // A tiebreaker, or rows sharing a timestamp can swap between pages.
    query = query.order("_id", { ascending }).range(offset, offset + limit - 1);

    query = param.archived
      ? query.not("archived_on", "is", null)
      : query.is("archived_on", null);
    if (param.start_date) {
      query = query.gte("created_at", param.start_date);
    }
    if (param.end_date) {
      query = query.lte("created_at", param.end_date);
    }
    // `false` is a real filter (UnConfirmed / UnAssigned), so test for undefined -
    // an `if (param.confirmed)` guard made the else branches unreachable and those
    // filters only ever ran client-side, over whichever page the server returned.
    if (param.confirmed !== undefined) {
      query = param.confirmed
        ? query.not("confirmed_on", "is", null)
        : query.is("confirmed_on", null);
    }

    if (param.assigned !== undefined) {
      query = param.assigned
        ? query.not("agent_id", "is", null)
        : query.is("agent_id", null);
    }

    if (param.category) {
      query = query.in("item", param.category);
    }

    if (param.source) {
      // Case-insensitive, like the earnings and report queries (ILIKE ANY): an order
      // stamped "ella" belongs to source "Ella", and an exact match dropped it.
      const sources = param.source
        .map((v) => v.replace(/[%_(),"\\*]/g, "").trim())
        .filter(Boolean);
      query = sources.length
        ? query.or(sources.map((v) => `source.ilike."${v}"`).join(","))
        : query.in("source", []); // none chosen: nothing matches, as before
    }

    if (param.delivery_status) {
      query.eq("delivery_status", param.delivery_status);
    }

    if (param.agent_id) {
      query.eq("agent_id", param.agent_id);
    }
    if (param.phone) {
      query = query.like("phone_digits", `%${normalizePhoneQuery(param.phone)}%`);
    }

    if (param.search?.trim()) {
      const scope = param.searchIn ?? "all";
      const clauses = searchClauses({ scope, text: param.search });
      if (clauses.length > 0) {
        query = query.or(clauses.join(","));
      } else if (scope !== "all") {
        // Nothing in the text can match this field ("phone: 0" has no digits once
        // the leading zero goes). Without a filter the query would return every
        // order, which reads as "they all match".
        this._totalOrders = 0;
        this._loading = false;
        this._orders.clear();
        this.notifySubscribers(this.orders);
        return;
      }
    }

    const { data, count, error } = await new WithAuth(query.abortSignal(signal))
      .unwrap();
    // postgrest-js resolves an aborted request with data: null rather than throwing.
    // A newer fetch owns the list by then, so this one must not clear it or touch the
    // loading flag - and updateOrders(null) would throw on .reverse().
    if (signal.aborted) return;
    // A rejected query used to look exactly like "no matches". That is how a missing
    // phone_digits column on production hid for days: every phone search came back
    // empty with nothing to say why. An expired session is handled by WithAuth.
    if (error && error.code != PG_UNAUTHORIZED) {
      console.error("orders query failed", error);
      const why = String(error.message ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
      Toast.error(`Couldn't load orders: ${why}`);
    }
    this._totalOrders = count ?? 0;
    this._loading = false;
    this._orders.clear();
    this.updateOrders((data ?? []) as IOrder[], new Carbon());
  }

  private async updateOrders(orders: IOrder[], timestamp: Carbon) {
    orders
      .reverse()
      .map((v) => new Order(v, timestamp))
      .forEach((o) => {
        o.subscribe(() => this.notifySubscribers(this.orders)); // register subscriber at order level
        this._orders.add(o);
      });
    this.notifySubscribers(this.orders);
  }

  public async deleteOrder(order: Order) {
    await order.destroy();
    this._orders.remove(order);
    this.notifySubscribers(this.orders);
  }
}

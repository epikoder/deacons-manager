import { SubscriberProvider } from "../../@types/subscribers";
import Bucket from "../../utils/bucket";
import Carbon from "../../utils/carbon";
import { postgrest, WithAuth } from "../../utils/postgrest";
import Order, { OrderItem } from "./order";

type AwaitedOrderWithSource = Promise<IOrder[]>;
type SourceTimeStamp = Record<string, Carbon>;

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

export default class OrderService extends SubscriberProvider<Order[]> {
  private _fetchInterval: number = 60000; // sec
  private _sources: Map<string, OrderSource> = new Map();
  private _orders: Bucket<Order> = new Bucket<Order>((order: Order) =>
    order.getUniqueID
  );
  private static _instance = new OrderService();
  private _fetchParam: SearchParam = defaulSearchParam;
  private _lastRefreshTimeStamp: SourceTimeStamp = {};
  private _totalOrders = 0;
  private _loading = false;
  private _costPerBook = 1200;

  get lastRefreshTimeStamp(): SourceTimeStamp {
    return this._lastRefreshTimeStamp;
  }

  get sourceList(): string[] {
    return [...this._sources.keys()];
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
          : new Carbon("2024-01-01");
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

  private async backgroundRefresh() {
    setTimeout(async () => {
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
    for (const [source, fn] of arr) {
      promises = promises.concat(
        (async (param: SearchParam) => {
          return (await fn(param)).map((order) => ({
            ...order,
            source: source,
          }));
        })(this.sourceSearchParam(source)),
      );
    }

    const res = await Promise.all(promises);

    let s = performance.now();
    for (const orders of res) {
      const o = orders.at(0);
      if (!o) continue;
      const timestamp = this.lastRefreshTimeStamp[sourceAsID(o.source)];
      this.updateOrders(orders, timestamp);
      this.lastRefreshTimeStamp[sourceAsID(o.source)] = new Carbon();
    }
    this.updateLastTimeStamp();
  }

  public registerSource(name: string, source: OrderSource, date?: Carbon) {
    this._sources.set(name, source);
    this._lastRefreshTimeStamp[sourceAsID(name)] = date ??
      new Carbon("2024-01-01"); // TODO: set to Dec - 1
    this.notifySubscribers(this.orders);
  }

  public async fetchOrders(
    page = 1,
    param = {
      limit: 100,
    } as Omit<SearchParam, "offset"> & {
      confirmed?: boolean;
      assigned?: boolean;
      delivery_status?: DeliveryStatus;
      source?: string[];
      category?: string[];
      agent_id?: string;
    },
  ) {
    this._loading = true;
    this.notifySubscribers(this.orders);

    let rngEnd = param.limit ?? 100;
    let offset = 0;
    if (page <= 1) {
      offset = 0;
      rngEnd -= 1;
    } else {
      offset = (page - 1) * rngEnd;
      rngEnd = offset + param.limit;
    }

    let query = postgrest
      .from("orders")
      .select(`*,agents(*)`, { count: "exact" })
      .order("created_at", {
        ascending: false,
      })
      .range(offset, rngEnd);
    if (param.start_date) {
      query = query.gte("created_at", param.start_date);
    }
    if (param.end_date) {
      query = query.lte("created_at", param.end_date);
    }
    if (param.confirmed) {
      if (param.confirmed) {
        query = query.not("confirmed_on", "is", null);
      } else {
        query = query.is("confirmed_on", null);
      }
    }

    if (param.assigned) {
      if (param.assigned) {
        query = query.not("agent_id", "is", null);
      } else {
        query = query.is("agent_id", null);
      }
    }

    if (param.category) {
      query = query.in("item", param.category);
    }

    if (param.source) {
      query = query.in("source", param.source);
    }

    if (param.delivery_status) {
      query.eq("delivery_status", param.delivery_status);
    }

    if (param.agent_id) {
      query.eq("agent_id", param.agent_id);
    }
    const { data, count } = await new WithAuth(query).unwrap();
    this._totalOrders = count ?? 0;
    this._loading = false;
    this._orders.clear();
    this.updateOrders(data as IOrder[], new Carbon());
  }

  private updateOrders(orders: IOrder[], timestamp: Carbon) {
    new Promise(() => {
      orders
        .reverse()
        .map((v) => new Order(v, timestamp))
        .forEach((o) => {
          o.subscribe(() => this.notifySubscribers(this.orders));
          this._orders.add(o);
        });
      this.notifySubscribers(this.orders);
    });
  }

  public async deleteOrder(order: Order) {
    await order.destroy();
    this._orders.remove(order);
    this.notifySubscribers(this.orders);
  }
}

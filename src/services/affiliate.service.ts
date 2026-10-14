import { useEffect, useState } from "react";
import { Observer } from "../../@types/observable";
import { SubscriberProvider } from "../../@types/subscribers";
import { postgrest, WithAuth } from "../utils/postgrest";
import { normalizePhoneQuery } from "../utils/phone";
import Carbon from "../utils/carbon";
import Balance from "./balance";

export default class AffiliateService extends SubscriberProvider<Affiliate[]> {
  private _affiliates: Map<string, Affiliate> = new Map();
  private static _instance = new AffiliateService();
  private _total = 0;

  static get instance(): AffiliateService {
    return this._instance;
  }

  get affiliates() {
    return [...this._affiliates.values()];
  }

  get total() {
    return this._total;
  }

  private _loading = false;
  private _seq = 0;

  get loading() {
    return this._loading;
  }

  async fetch(
    page = 1,
    param = {
      limit: 100,
    } as { limit: number; search?: string; state?: string },
  ): Promise<void> {
    // Only the newest request may replace the list: a slow earlier search
    // resolving last would otherwise overwrite the results being typed for.
    const seq = ++this._seq;
    this._loading = true;
    this.notifySubscribers(this.affiliates);
    const limit = param.limit > 0 ? param.limit : 100;
    // range() is inclusive; page 2 onwards used to ask for limit + 1 rows.
    const offset = (Math.max(page, 1) - 1) * limit;
    let query = postgrest
      .from("affiliates")
      .select("*", { count: "exact" })
      .order("fullname", { ascending: true })
      .range(offset, offset + limit - 1);
    const search = (param.search ?? "").replace(/[(),"\\*]/g, " ").trim();
    if (search) {
      // Phones are stored as 0XXXXXXXXXX, so match the digits whatever format
      // was typed (+234 803..., 0803-...).
      const digits = normalizePhoneQuery(search);
      query = query.or(
        [
          `fullname.ilike."*${search}*"`,
          ...(digits.length >= 3 ? [`phone.like."*${digits}*"`] : []),
          `email.ilike."*${search}*"`,
        ].join(","),
      );
    }
    const { data, error, count } = await new WithAuth(query).unwrap();
    if (seq !== this._seq) return;
    this._loading = false;
    if (error) {
      console.error("affiliates query failed", error);
      this.notifySubscribers(this.affiliates);
      return;
    }
    this._affiliates.clear();
    this._total = count ?? 0;
    ((data ?? []) as any[]).forEach((v: any) => this._affiliates.set(v.id, new Affiliate(v)));
    this.notifySubscribers(this.affiliates);
  }

}

export class Affiliate extends Observer {
  constructor(affiliate: IAffiliate) {
    super();
    this._inner = affiliate;
    this._balance = new Balance({ source_filter: this.source });
    this._balance.subscribe(() => this.notifySubscribers());

    Promise.all([
      new WithAuth(
        postgrest
          .from("affiliate_orders")
          .select("_id", {
            count: "exact",
          })
          .eq("aid", this.ID)
          .limit(0),
      ).unwrap(),
      new WithAuth(
        postgrest
          .from("affiliate_orders")
          .select("_id", {
            count: "exact",
          })
          .eq("aid", this.ID)
          .gte(
            "created_at",
            new Carbon(
              new Date().getFullYear(),
              new Date().getMonth(),
              1,
            ).localISO(),
          )
          .limit(0),
      ).unwrap(),
    ]).then(([r1, r2]) => {
      this._orderCount = r1.count!;
      this._orderCountForCurrentCycle = r2.count!;
      this.notifySubscribers();
    });
  }
  private _inner: IAffiliate;
  private _orderCount = 0;
  private _orderCountForCurrentCycle = 0;
  private _balance: Balance;

  get ID() {
    return this._inner.id;
  }

  get name() {
    return this._inner.fullname;
  }

  get phone() {
    return this._inner.phone;
  }
  get email() {
    return this._inner.email;
  }

  get source() {
    return this._inner.source_list;
  }

  get balance(): [number, number] {
    return [this._balance.value, this._balance.totalEarning];
  }

  get totalOrders() {
    return this._orderCount;
  }

  get totalOrderForCurrentCycle() {
    return this._orderCountForCurrentCycle;
  }

  Balance(): Balance {
    return this._balance;
  }
}

/** `autoFetch` false: the caller drives fetch() (paging, search). */
export const useAffiliates = (autoFetch = true) => {
  const [agents, setAgents] = useState<Affiliate[]>([]);
  useEffect(() => {
    const service = AffiliateService.instance;
    const handleOrdersChange = (newOrders: Affiliate[]) => {
      setAgents(newOrders);
    };
    service.subscribe(handleOrdersChange);
    setAgents(service.affiliates);
    if (autoFetch) service.fetch();
    return () => {
      service.unsubscribe(handleOrdersChange);
    };
  }, []);
  return agents;
};

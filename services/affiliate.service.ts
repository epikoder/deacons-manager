import { useEffect, useState } from "react";
import { Observer } from "../@types/observable";
import { SubscriberProvider } from "../@types/subscribers";
import { postgrest, WithAuth } from "../utils/postgrest";
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

  async fetch(
    page = 1,
    param = {
      limit: 100,
    } as { limit: number; search?: string; state?: string },
  ): Promise<void> {
    this._affiliates.clear();
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
      .from("affiliates")
      .select("*", { count: "exact" })
      .range(offset, rngEnd);
    if (param.search) {
      query.or(
        `phone.ilike.%${param.search}%,fullname.ilike.%${param.search}%`,
      );
    }
    if (param.state) {
      query.eq("state", param.state);
    }
    const { data, error, count } = await new WithAuth(query).unwrap();
    if (error) return;
    data.forEach((v) => this._affiliates.set(v.id, new Affiliate(v)));
    this._total = count ?? 0;
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

export const useAffiliates = (page?: number) => {
  const [agents, setAgents] = useState<Affiliate[]>([]);
  useEffect(() => {
    const service = AffiliateService.instance;
    const handleOrdersChange = (newOrders: Affiliate[]) => {
      setAgents(newOrders);
    };
    service.subscribe(handleOrdersChange);
    setAgents(service.affiliates);
    service.fetch(page);
    return () => {
      service.unsubscribe(handleOrdersChange);
    };
  }, []);
  return agents;
};

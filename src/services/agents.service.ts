import { useEffect, useState } from "react";
import { SubscriberProvider } from "../../@types/subscribers";
import { Observer } from "../../@types/observable";
import { postgrest, WithAuth } from "../utils/postgrest";
import { normalizePhoneQuery } from "../utils/phone";
import Toast, { escapeHtml } from "../utils/toast";
import Carbon from "../utils/carbon";
import Balance from "./balance";

export default class AgentService extends SubscriberProvider<Agent[]> {
  private _agents: Map<string, Agent> = new Map();
  private static _instance = new AgentService();
  private _total = 0;

  static get instance() {
    return AgentService._instance;
  }

  get agents() {
    return [...this._agents.values()];
  }

  get total() {
    return this._total;
  }

  public addAgent(agent: Agent) {
    this._agents.set(agent.ID, agent);
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
  ) {
    // Only the newest request may replace the list: a slow earlier search
    // resolving last would otherwise overwrite the results being typed for.
    const seq = ++this._seq;
    this._loading = true;
    this.notifySubscribers(this.agents);
    const limit = param.limit > 0 ? param.limit : 100;
    // range() is inclusive; page 2 onwards used to ask for limit + 1 rows.
    const offset = (Math.max(page, 1) - 1) * limit;
    let query = postgrest
      .from("agents")
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
    if (param.state) {
      query = query.eq("state", param.state);
    }
    const { data, error, count } = await new WithAuth(query).unwrap();
    if (seq !== this._seq) return;
    this._loading = false;
    if (error) {
      console.error("agents query failed", error);
      this.notifySubscribers(this.agents);
      return;
    }
    this._agents.clear();
    this._total = count ?? 0;
    ((data ?? []) as any[]).forEach((v: any) => this._agents.set(v.id, new Agent(v)));
    this.notifySubscribers(this.agents);
  }

}

export class Agent extends Observer {
  constructor(agent: IAgent) {
    super();
    this._inner = agent;
    this._balance = new Balance({ id: this.ID });
    this._balance.subscribe(() => this.notifySubscribers());

    Promise.all([
      new WithAuth(
        postgrest
          .from("orders")
          .select("_id", { count: "exact" })
          .eq("agent_id", agent.id)
          .limit(0),
      ).unwrap(),
      new WithAuth(
        postgrest
          .from("orders")
          .select("_id", { count: "exact" })
          .eq("agent_id", agent.id)
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

  private _inner: IAgent;
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

  get state() {
    return this._inner.state;
  }

  get balance(): [number, number] {
    return [this._balance.value, this._balance.totalEarning];
  }

  get totalOrderForCurrentCycle() {
    return this._orderCountForCurrentCycle;
  }

  get totalOrders() {
    return this._orderCount;
  }

  get books() {
    return this._inner.books ?? {};
  }

  get email() {
    return this._inner.email;
  }

  async updateBooks(books: BookConfig): Promise<void> {
    const previous = this._inner.books;
    this._inner.books = books;
    try {
      await this.update();
    } catch (error) {
      this._inner.books = previous;
      this.notifySubscribers();
      throw error;
    }
  }

  async update() {
    const { error } = await new WithAuth(
      postgrest.from("agents").upsert(this._inner).eq("id", this._inner.id),
    ).unwrap();
    if (error) {
      // Failures used to vanish: the card showed the new books, the row did not.
      console.error("agent save failed", error);
      Toast.error(`Couldn't save agent: ${escapeHtml(error.message ?? "")}`);
      throw error;
    }
    this.notifySubscribers();
  }

  public Balance(): Balance {
    return this._balance;
  }
}

/** `autoFetch` false: the caller drives fetch() (paging, search, state filter). */
export const useAgent = (autoFetch = true) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  useEffect(() => {
    const agentService = AgentService.instance;
    const handleOrdersChange = (newOrders: Agent[]) => {
      setAgents(newOrders);
    };
    agentService.subscribe(handleOrdersChange);
    setAgents(agentService.agents);
    if (autoFetch) agentService.fetch();
    return () => {
      agentService.unsubscribe(handleOrdersChange);
    };
  }, []);
  return agents;
};

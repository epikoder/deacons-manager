import { useEffect, useState } from "react";
import { SubscriberProvider } from "../../@types/subscribers";
import { Observer } from "../../@types/observable";
import { postgrest, WithAuth } from "../utils/postgrest";
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

  async fetch(
    page = 1,
    param = {
      limit: 100,
    } as { limit: number; search?: string; state?: string },
  ) {
    this._agents.clear();
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
      .from("agents")
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
    if (error) {
      return;
    }

    this._total = count ?? 0;
    data?.map((v) => this._agents.set(v.id, new Agent(v)));
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

  async updateBooks(books: BookConfig): Promise<void> {
    this._inner.books = books;
    await this.update();
  }

  async update() {
    await new WithAuth(
      postgrest.from("agents").upsert(this._inner).eq("id", this._inner.id),
    ).unwrap();
    this.notifySubscribers();
  }

  public Balance(): Balance {
    return this._balance;
  }
}

export const useAgent = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  useEffect(() => {
    const agentService = AgentService.instance;
    const handleOrdersChange = (newOrders: Agent[]) => {
      setAgents(newOrders);
    };
    agentService.subscribe(handleOrdersChange);
    setAgents(agentService.agents);
    agentService.fetch();
    return () => {
      agentService.unsubscribe(handleOrdersChange);
    };
  }, []);
  return agents;
};

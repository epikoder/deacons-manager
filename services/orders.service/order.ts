import { Observer } from "../../@types/observable";
import Carbon from "../../utils/carbon";
import { postgrest, WithAuth } from "../../utils/postgrest";
import AgentService, { Agent } from "../agents.service";
import OrderService from "./orders.service";

const OFFICE_CHARGE = .1; // 10%

export enum OrderItem {
  none = "None",
  jambArt = "Jamb Art",
  jambScience = "Jamb Science",
  jambCommercial = "Jamb Commercial",
  waecArt = "Waec Art",
  waecScience = "Waec Science",
  waecCommercial = "Waec Commercial",
  jambWaecArt = "Jamb & Waec Art",
  jambWaecScience = "Jamb & Waec Science",
  jambWaecCommercial = "Jamb & Waec Commercial",
}

export default class Order extends Observer {
  constructor(
    order: IOrder & {
      agents?: IAgent;
    },
    timestamp = new Carbon(),
  ) {
    super();
    const { agents: _agent, ..._order } = order;
    this._inner = _order;
    !this._inner.delivery_status && (this._inner.delivery_status = "pending");
    !this._inner.office_charge &&
      (this._inner.office_charge = this._inner.order_amount * OFFICE_CHARGE);

    if (_agent) {
      let agent = AgentService.instance.agents.find((a) => a.ID == _agent.id);
      if (!agent) {
        agent = new Agent(_agent);
        AgentService.instance.addAgent(agent);
      }
      this._agent = agent;
    }

    this._created_at = new Carbon(order.created_at);
    this._timestamp = timestamp;
    order.confirmed_on && (this._confirmed_on = new Carbon(order.confirmed_on));
    order.assigned_on && (this._assigned_on = new Carbon(order.assigned_on));

    if (!this._inner._id) {
      this.update();
    }
  }

  private _inner: IOrder;
  private _created_at: Carbon;
  private _timestamp: Carbon;
  private _confirmed_on?: Carbon;
  private _assigned_on?: Carbon;
  private _agent?: Agent;

  get ID() {
    return this._inner._id;
  }

  get source() {
    return this._inner.source;
  }

  get date() {
    return this._created_at.string;
  }

  get isNewOrder() {
    if (this._assigned_on) {
      return this._assigned_on.diff(new Carbon()).minute < 10;
    }
    if (this._confirmed_on) {
      return this._confirmed_on.diff(new Carbon()).minute < 30;
    }
    return this._created_at.diff(this._timestamp).minute < 60;
  }

  get phone() {
    return this._inner.phone;
  }

  get email() {
    return this._inner.email;
  }

  get state() {
    return this._inner.state;
  }

  get address() {
    return this._inner.address;
  }

  get agent() {
    return this._agent;
  }

  get agentName(): NullString {
    return this._agent ? `${this._agent.name} - ${this._agent.state}` : null;
  }

  get isComfirmed() {
    return this._confirmed_on != undefined;
  }

  get isAssignedToAgent() {
    return this._inner.agent_id != undefined;
  }

  get deliveryCost() {
    return this._inner.delivery_cost;
  }

  get deliveryStatus() {
    return this._inner.delivery_status ?? "pending";
  }

  get canMutate() {
    return this.deliveryStatus !== "delivered";
  }

  get deliveredOn(): Carbon | undefined {
    let delivered_on = this._inner.delivered_on
      ? new Carbon(this._inner.delivered_on)
      : undefined;
    if (!this._inner.delivered_on && this.deliveryStatus == "delivered") {
      delivered_on = new Carbon();
      this._inner.delivered_on = delivered_on.localISO();
      this.update();
    }
    return delivered_on;
  }

  get deliveryStatusWeight(): number {
    return this.deliveryStatus == "pending" ? 0 : 1;
  }

  get officeCharge() {
    return this._inner.office_charge;
  }

  get orderItem(): OrderItem {
    return this._inner.item;
  }

  get orderAmount() {
    return this._inner.order_amount;
  }

  get customerName() {
    return this._inner.fullname;
  }

  get books() {
    return this._inner.books;
  }

  get createdAt() {
    return this._created_at;
  }

  get agentEarning() {
    return this.deliveryCost ?? 0;
  }
  get affiliateEarning() {
    const ae = this.orderAmount - this.actualCost;
    return ae <= 0 ? 0 : ae;
  }

  get actualCost() {
    return this._totalCost(this.totalBookCost());
  }

  public isConfigValidForPaidAmount(books: BookConfig, delivery_cost: number) {
    const cost = Object.entries(books).map(([_, count]) =>
      count * (OrderService.instance.costPerBook)
    ).sum();
    return this.orderAmount > this._totalCost(cost, delivery_cost);
  }

  private _totalCost(totalCostOfBooks: number, delivery_cost?: number) {
    return (delivery_cost ?? this._inner.delivery_cost ?? 0) +
      totalCostOfBooks +
      (this.officeCharge ?? 0);
  }

  totalBookCost(costPerBook?: number) {
    return Object.entries(this.books ?? {}).map(([_, count]) =>
      count * (costPerBook ?? OrderService.instance.costPerBook)
    ).sum();
  }

  isBefore(date: Carbon): boolean {
    const x = new Carbon(this._created_at.formatLocalISO());
    const y = new Carbon(date.format());
    return x.diff(date).day >= 0;
  }

  isAfter(date: Carbon): boolean {
    const x = new Carbon(this._created_at.formatLocalISO());
    const y = new Carbon(date.format());
    return x.diff(date).day <= 0;
  }

  get getUniqueID(): string {
    return `${this._inner.source.toLowerCase()}-${
      String(
        this._inner.id,
      ).toLowerCase()
    }`;
  }

  async assignAgent(agent: Agent) {
    this._inner.agent_id = agent.ID;
    this._inner.assigned_on = new Carbon().localISO();
    this._agent = agent;
    this.update();
  }

  async unAssignAgent() {
    this._inner.agent_id = undefined;
    this._agent = undefined;
    this.update();
  }

  async updateAddress(info: { state: string; address: string }) {
    this._inner.address = info.address;
    this._inner.state = info.state;
    this.update();
  }

  async destroy() {
    await new WithAuth(
      postgrest.from("orders").delete().eq("id", this._inner.id).eq(
        "source",
        this._inner.source,
      ),
    ).unwrap();
  }

  async confirmOrder() {
    this._confirmed_on = new Carbon();
    this._inner.confirmed_on = this._confirmed_on.localISO();
    this.update();
  }

  async unConfirmOrder() {}

  async updateDelivery(status: DeliveryStatus, amount?: number) {
    this._inner.delivery_status = status;
    this._inner.delivery_cost = amount;

    if (status === "delivered") {
      this._inner.delivered_on = new Carbon().localISO();
      if (!this.agent) {
        throw new Error("No agent");
      }
      const agentBooks = this.agent.books;
      const books = this.books ?? {};
      Object.keys(books).forEach((key) => {
        if (agentBooks[key]) {
          const holding = agentBooks[key];
          agentBooks[key] -= books[key];
          if (agentBooks[key] < 0) {
            throw new Error(`${key} exceeded allocated value: ${holding}`);
          }
        }
      });
      this.agent.updateBooks(agentBooks);
    }

    this.update();
  }

  async updateOfficeCharge(amount: number) {
    this._inner.office_charge = amount;
    this.update();
  }

  async updateOrderItem(item: OrderItem) {
    this._inner.item = item;
    this.update();
  }

  async updateAmount(amount: number) {
    this._inner.order_amount = amount;
    this._inner.office_charge = amount * OFFICE_CHARGE;
    this.update();
  }

  async setBookConfiguration(subs: BookConfig) {
    this._inner.books = subs;
  }

  async updateBookConfiguration(subs: BookConfig) {
    this._inner.books = subs;
    this.update();
  }

  async update() {
    const { data } = await new WithAuth(
      postgrest.from("orders").upsert(this._inner).select("id").single(),
    ).unwrap();
    !this.ID && (this._inner._id = data?.id);
    this.notifySubscribers();
  }

  static create(): Order {
    return new Order({
      address: "",
      created_at: new Date().toISOString(),
      email: "",
      fullname: "",
      id: 1,
      order_amount: 10000,
      phone: "09283918310",
      source: "",
      state: "",
      item: "",
    }, new Carbon());
  }
}

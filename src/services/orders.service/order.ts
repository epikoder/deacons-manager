import { Observer } from "../../../@types/observable";
import Carbon from "../../utils/carbon";
import { postgrest, WithAuth } from "../../utils/postgrest";
import Toast from "../../utils/toast";
import AgentService, { Agent } from "../agents.service";
import OrderService from "./orders.service";

export const OFFICE_CHARGE = .1; // 10%

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
      this.save(true).catch(() => {});
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

  /** The order number on the affiliate site it came from. */
  get orderNumber() {
    return String(this._inner.id);
  }

  get isArchived() {
    return !!this._inner.archived_on;
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
      // Runs during render, so a failure must not surface as a toast on every paint.
      this.save(true).catch(() => {});
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
    await this.mutate(() => {
      const now = new Carbon();
      this._inner.agent_id = agent.ID;
      this._inner.assigned_on = now.localISO();
      this._agent = agent;
      // Handing an order to an agent confirms it. The database enforces the same rule
      // (confirm_orders_on_assign), this just keeps the card in step without a refetch.
      if (!this._confirmed_on) {
        this._confirmed_on = now;
        this._inner.confirmed_on = now.localISO();
      }
    });
  }

  async unAssignAgent() {
    await this.mutate(() => {
      this._inner.agent_id = undefined;
      this._agent = undefined;
    });
  }

  async updateAddress(info: { state: string; address: string }) {
    await this.mutate(() => {
      this._inner.address = info.address;
      this._inner.state = info.state;
    });
  }

  async archive() {
    await this.mutate(() => {
      this._inner.archived_on = new Carbon().localISO();
    });
  }

  async unarchive() {
    await this.mutate(() => {
      this._inner.archived_on = null;
    });
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
    await this.mutate(() => {
      this._confirmed_on = new Carbon();
      this._inner.confirmed_on = this._confirmed_on.localISO();
    });
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
    await this.mutate(() => {
      this._inner.office_charge = amount;
    });
  }

  async updateOrderItem(item: OrderItem) {
    await this.mutate(() => {
      this._inner.item = item;
    });
  }

  async updateAmount(amount: number) {
    await this.mutate(() => {
      this._inner.order_amount = amount;
      this._inner.office_charge = amount * OFFICE_CHARGE;
    });
  }

  async setBookConfiguration(subs: BookConfig) {
    this._inner.books = subs;
  }

  async updateBookConfiguration(subs: BookConfig) {
    await this.mutate(() => {
      this._inner.books = subs;
    });
  }

  /**
   * Apply a change locally and persist it. If the write is rejected the order goes
   * back to what the database still holds, rather than showing a card that looks
   * confirmed (or assigned, or archived) and reverts on the next reload.
   */
  private async mutate(change: VoidFunction) {
    const inner = { ...this._inner };
    const confirmedOn = this._confirmed_on;
    const agent = this._agent;
    change();
    try {
      await this.update();
    } catch (error) {
      this._inner = inner;
      this._confirmed_on = confirmedOn;
      this._agent = agent;
      this.notifySubscribers();
      throw error;
    }
  }

  async update() {
    await this.save(false);
  }

  private async save(silent: boolean) {
    // phone_digits is GENERATED ALWAYS: Postgres rejects any row that carries it
    // (428C9), and it comes back on every select("*"). Sending it made every edit -
    // confirm, assign, books - fail, silently, so the UI and the database disagreed.
    const { phone_digits: _generated, ...row } = this._inner;
    const { data, error } = await new WithAuth(
      postgrest.from("orders").upsert(row).select("_id").single(),
    ).unwrap();
    if (error) {
      console.error("order save failed", error, row);
      if (!silent) {
        Toast.error(`Couldn't save order: ${escapeHtml(error.message ?? "")}`);
      }
      throw error;
    }
    // This used to select "id" - the affiliate's order number - into _id, the uuid.
    !this.ID && (this._inner._id = (data as { _id?: string } | null)?._id);
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

const escapeHtml = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

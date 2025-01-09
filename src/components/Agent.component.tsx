import { Fragment } from "react/jsx-runtime";
import { useObserver } from "../../@types/observable";
import { Agent } from "../services/agents.service";
import DropDown from "./Dropdown";
import {
  ActivityIndicator,
  ChevronDown,
  ChevronUp,
  CopyIcon,
  PhoneIcon,
} from "./Icons";
import { useEffect, useState } from "react";
import { postgrest, WithAuth } from "../utils/postgrest";
import Order from "../services/orders.service/order";
import { OrderComponent } from "./Order.component";
import Carbon from "../utils/carbon";

export const AgentComponent = ({ agent }: { agent: Agent }) => {
  useObserver(agent);

  return (
    <div onClick={() => console.log(agent)} className="rounded-lg shadow-md">
      <div className="p-4 flex gap-8 justify-between">
        <div>
          <div>{agent.name}</div>
          <div className="text-zinc-600">
            <span className="font-semibold text-2xl">
              {Intl.NumberFormat().format(agent.totalOrderForCurrentCycle)}
            </span>
            &nbsp;
            <span className="text-xs">{new Carbon().month}</span>
            &nbsp;
            <span>/</span>&nbsp;
            <span>{Intl.NumberFormat().format(agent.totalOrders)}</span>
            &nbsp;
            <span className="text-xs">total</span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-3">
            <a
              className="flex gap-2 w-fit items-center"
              href={`tel:${agent.phone}`}
            >
              <PhoneIcon className="size-3 text-blue-500" />
              <div>{agent.phone}</div>
            </a>
            <button
              className="px-1"
              onClick={() => {
                navigator.clipboard.writeText(agent.phone);
                alert("copied!!");
              }}
            >
              <CopyIcon className="size-4" />
            </button>
          </div>
          <div className="font-bold">{agent.state}</div>
        </div>
      </div>
      <div className="p-4 relative">
        <DropDown className="flex flex-col gap-4">
          {(isOpen) => [
            <div className="text-xs cursor-pointer flex items-center gap-3 w-fit">
              <span>Recent Orders</span>
              <span className="relative size-5">
                <ChevronDown
                  className={`absolute transition-all duration-300 ${
                    isOpen ? "opacity-0" : ""
                  }`}
                />
                <ChevronUp
                  className={`absolute transition-all duration-300 ${
                    !isOpen ? "opacity-0" : ""
                  }`}
                />
              </span>
            </div>,
            <RecentOrders id={agent.ID} />,
          ]}
        </DropDown>
        <div className="absolute right-4 top-2 flex items-center gap-4">
          <a href={`/agents/orders/${agent.ID}`} className="flex-1">
            <div className="text-center text-white bg-blue-500 text-xs rounded-lg whitespace-nowrap px-4 py-1 hover:bg-opacity-75">
              View Orders
            </div>
          </a>
          <a href={`/agents/profile/${agent.ID}`} className="flex-1">
            <div className="text-center text-white bg-teal-500 text-xs rounded-lg whitespace-nowrap px-4 py-1 hover:bg-opacity-75">
              View Profile
            </div>
          </a>
        </div>
      </div>
    </div>
  );
};

const RecentOrders = ({ id }: { id: string }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  let controller: AbortController;

  const __ = async () => {
    controller = new AbortController();
    const { data, error } = await new WithAuth(
      postgrest
        .from("orders")
        .select(`*,agents(*)`)
        .eq("agent_id", id)
        .order("created_at", { ascending: false })
        .limit(3)
        .abortSignal(controller.signal),
    ).unwrap();
    setLoading(false);
    if (error) {
      return;
    }
    setOrders(data?.map((v) => new Order(v)));
  };

  useEffect(() => {
    __();
    return () => controller.abort();
  }, []);

  return (
    <Fragment>
      {loading && (
        <div className="py-8 flex flex-col justify-center items-center">
          <ActivityIndicator active />
        </div>
      )}
      {!loading &&
        orders
          .sort(
            (o, o1) =>
              (o.isAssignedToAgent ? 1 : 0) - (o1.isAssignedToAgent ? 1 : 0),
          )
          .sort((o, o1) => o.deliveryStatusWeight - o1.deliveryStatusWeight)
          .map((order) => <OrderComponent key={order.ID} order={order} />)}
    </Fragment>
  );
};

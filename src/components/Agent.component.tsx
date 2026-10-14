import CopyButton from "./CopyButton";
import { useObserver } from "../../@types/observable";
import { Agent } from "../services/agents.service";
import { ActivityIndicator, ChevronDown, ChevronUp, PhoneIcon } from "./Icons";
import { useEffect, useState } from "react";
import { postgrest, WithAuth } from "../utils/postgrest";
import Order from "../services/orders.service/order";
import { OrderComponent } from "./Order.component";
import Carbon from "../utils/carbon";
import { Avatar, fmtCount, smallButton } from "./ui";

export const booksHeld = (books: BookConfig) =>
  Object.values(books ?? {}).filter((n) => n > 0).reduce((s, n) => s + n, 0);

export const AgentComponent = ({ agent }: { agent: Agent }) => {
  useObserver(agent);
  const [open, setOpen] = useState(false);
  const held = booksHeld(agent.books);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={agent.name} />
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <a
                href={`/agents/profile/${agent.ID}`}
                className="truncate font-semibold text-zinc-900 hover:underline"
              >
                {agent.name}
              </a>
              {agent.state && (
                <span className="ml-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600">
                  {agent.state}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-sm">
              <a
                className="flex items-center gap-1.5 text-blue-600 hover:underline tabular-nums"
                href={`tel:${agent.phone}`}
              >
                <PhoneIcon className="size-3" />
                {agent.phone}
              </a>
              <CopyButton value={agent.phone} label="Copy phone number" />
            </div>
          </div>
        </div>
        <dl className="flex gap-6 text-right">
          <div>
            <dt className="text-xs text-zinc-500">{new Carbon().month}</dt>
            <dd className="text-lg font-semibold tabular-nums text-zinc-900">
              {fmtCount(agent.totalOrderForCurrentCycle)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">All orders</dt>
            <dd className="text-lg font-semibold tabular-nums text-zinc-900">
              {fmtCount(agent.totalOrders)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Books held</dt>
            <dd className="text-lg font-semibold tabular-nums text-zinc-900">
              {fmtCount(held)}
            </dd>
          </div>
        </dl>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 px-4 py-3">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900"
        >
          Recent orders
          {open
            ? <ChevronUp className="size-3.5" />
            : <ChevronDown className="size-3.5" />}
        </button>
        <div className="flex-1" />
        <a href={`/agents/orders/${agent.ID}`} className={smallButton}>
          Orders
        </a>
        <a href={`/agents/profile/${agent.ID}`} className={smallButton}>
          Profile
        </a>
      </div>
      {open && (
        <div className="flex flex-col gap-3 border-t border-zinc-100 bg-zinc-50/60 p-4">
          <RecentOrders id={agent.ID} />
        </div>
      )}
    </div>
  );
};

const RecentOrders = ({ id }: { id: string }) => {
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    new WithAuth(
      postgrest
        .from("orders")
        .select(`*,agents(*)`)
        .eq("agent_id", id)
        .is("archived_on", null)
        .order("created_at", { ascending: false })
        .limit(3)
        .abortSignal(controller.signal),
    ).unwrap().then(({ data, error }) => {
      if (controller.signal.aborted) return;
      setOrders(error ? [] : (data ?? []).map((v) => new Order(v)));
    });
    return () => controller.abort();
  }, [id]);

  if (!orders) {
    return (
      <div className="flex justify-center py-6 text-zinc-400">
        <ActivityIndicator active />
      </div>
    );
  }
  if (orders.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-zinc-500">
        No orders assigned yet.
      </div>
    );
  }
  return (
    <>
      {orders.map((order) => (
        <OrderComponent key={order.getUniqueID} order={order} />
      ))}
    </>
  );
};

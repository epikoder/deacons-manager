import { useData } from "vike-react/useData";
import { useEffect, useState } from "react";
import { OrderComponent } from "../../../../../src/components/Order.component";
import { Agent } from "../../../../../src/services/agents.service";
import { useObserver } from "../../../../../@types/observable";
import Pagination from "../../../../../src/components/Pagination";
import OrderService, {
  SortDirection,
} from "../../../../../src/services/orders.service/orders.service";
import { useOrderList } from "../../../../../src/services/orders.service/hook";
import { ActivityIndicator } from "../../../../../src/components/Icons";
import {
  EmptyState,
  fmtCount,
  NotFound,
  PageBody,
  PageHeader,
} from "../../../../../src/components/ui";

const PER_PAGE = 50;
type Status = "all" | "pending" | "delivered";
const STATUS_LABEL: Record<Status, string> = {
  all: "All",
  pending: "Pending delivery",
  delivered: "Delivered",
};

export default function () {
  const { agent } = useData<{ agent?: Agent }>();
  if (!agent) {
    return <NotFound what="Agent" back={{ href: "/agents", label: "Agents" }} />;
  }
  return <AgentOrders agent={agent} />;
}

function AgentOrders({ agent }: { agent: Agent }) {
  useObserver(agent);
  const orders = useOrderList();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<Status>("all");
  const [sort, setSort] = useState<SortDirection>("desc");
  const service = OrderService.instance;

  // Paging used to move the page number and show the same 50 orders.
  useEffect(() => {
    service.fetchOrders(page, {
      limit: PER_PAGE,
      agent_id: agent.ID,
      delivery_status: status === "all" ? undefined : status,
      sort,
    });
  }, [page, status, sort]);

  const dir = sort === "asc" ? 1 : -1;
  const shown = orders
    .filter((o) => o.agent?.ID === agent.ID)
    .sort((a, b) =>
      status === "delivered"
        ? dir * ((a.deliveredOn?.getTime() ?? 0) - (b.deliveredOn?.getTime() ?? 0))
        : dir * (a.createdAt.getTime() - b.createdAt.getTime())
    );

  return (
    <PageBody>
      <PageHeader
        title={`Orders · ${agent.name}`}
        subtitle={`${fmtCount(agent.totalOrderForCurrentCycle)} this month · ${
          fmtCount(agent.totalOrders)
        } in total`}
        back={{ href: `/agents/profile/${agent.ID}`, label: agent.name }}
      />

      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              status === s
                ? "border-green-600 bg-green-600 text-white"
                : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
        <div className="flex-1" />
        <button
          type="button"
          className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
          onClick={() => {
            setSort(sort === "asc" ? "desc" : "asc");
            setPage(1);
          }}
        >
          {sort === "asc" ? "Oldest first" : "Newest first"} ⇅
        </button>
      </div>

      <p className="text-sm text-zinc-500 tabular-nums">
        {service.loading
          ? "Loading…"
          : `${fmtCount(service.totalOrders)} ${
            status === "all" ? "" : `${status} `
          }order${service.totalOrders === 1 ? "" : "s"}`}
      </p>

      {service.loading
        ? (
          <div className="flex h-40 items-center justify-center gap-2 text-sm text-zinc-500">
            <ActivityIndicator active className="size-5" /> Loading orders…
          </div>
        )
        : shown.length === 0
        ? (
          <EmptyState
            title={status === "all"
              ? "No orders assigned to this agent"
              : `No ${STATUS_LABEL[status].toLowerCase()} orders`}
          />
        )
        : (
          <div className="flex flex-col gap-4">
            {shown.map((order) => (
              <OrderComponent key={order.getUniqueID} order={order} />
            ))}
          </div>
        )}

      <Pagination
        onNavigate={setPage}
        perPage={PER_PAGE}
        total={service.totalOrders}
        page={page}
      />
    </PageBody>
  );
}

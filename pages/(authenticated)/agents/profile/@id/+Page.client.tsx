import { useData } from "vike-react/useData";
import { useEffect, useRef, useState } from "react";
import CopyButton from "../../../../../src/components/CopyButton";
import { Agent } from "../../../../../src/services/agents.service";
import { useObserver } from "../../../../../@types/observable";
import {
  ChevronDown,
  ChevronUp,
  PhoneIcon,
} from "../../../../../src/components/Icons";
import Carbon from "../../../../../src/utils/carbon";
import { SubjectSelect } from "../../../../../src/components/Select";
import { showAlertDialog } from "../../../../../src/components/Dialog";
import { useOrders } from "../../../../../src/services/orders.service/hook";
import OrderService from "../../../../../src/services/orders.service/orders.service";
import { OrderComponent } from "../../../../../src/components/Order.component";
import OrderStatsCharts from "../../../../../src/components/OrderStatsCharts";
import { booksHeld } from "../../../../../src/components/Agent.component";
import {
  Card,
  fmtCount,
  NotFound,
  PageBody,
  ProfileHeader,
  secondaryButton,
  smallButton,
  StatTile,
} from "../../../../../src/components/ui";
import Toast from "../../../../../src/utils/toast";

const bookOrder = (name: string) =>
  name.includes("SSCE") ? 1 : name.includes("UTME") ? 2 : 0;

export default function () {
  const { agent } = useData<{ agent?: Agent }>();
  if (!agent) {
    return <NotFound what="Agent" back={{ href: "/agents", label: "Agents" }} />;
  }
  return <AgentProfile agent={agent} />;
}

function AgentProfile({ agent }: { agent: Agent }) {
  useObserver(agent);
  const [year, setYear] = useState(new Date().getFullYear());

  // Balance is "this month" and "whole year" for the chosen year.
  useEffect(() => {
    agent.Balance().fetchEarningForYear(year);
  }, [year]);

  const monthName = new Carbon().month;

  return (
    <PageBody>
      <ProfileHeader
        back={{ href: "/agents", label: "Agents" }}
        name={agent.name}
        nameExtra={agent.state && (
          <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600">
            {agent.state}
          </span>
        )}
        meta={
          <>
            <span className="flex items-center gap-1">
              <a
                href={`tel:${agent.phone}`}
                className="flex items-center gap-1.5 text-blue-600 hover:underline tabular-nums"
              >
                <PhoneIcon className="size-3" />
                {agent.phone}
              </a>
              <CopyButton value={agent.phone} label="Copy phone number" />
            </span>
            {agent.email && <span>{agent.email}</span>}
          </>
        }
        actions={
          <>
            <a href={`/agents/orders/${agent.ID}`} className={secondaryButton}>
              All orders
            </a>
            <a href={`/agents/report/${agent.ID}`} className={secondaryButton}>
              Delivery report
            </a>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={`Orders in ${monthName}`}
          value={fmtCount(agent.totalOrderForCurrentCycle)}
        />
        <StatTile label="All orders" value={fmtCount(agent.totalOrders)} />
        <StatTile
          label={`Earned in ${monthName} ${year}`}
          value={agent.balance[0].asLocalCurrency()}
        />
        <StatTile
          label={`Earned in ${year}`}
          value={agent.balance[1].asLocalCurrency()}
        />
      </div>

      <BooksCard agent={agent} />
      <PendingOrders id={agent.ID} />
      <OrderStatsCharts agent={agent.ID} year={year} onYearChange={setYear} />
    </PageBody>
  );
}

function BooksCard({ agent }: { agent: Agent }) {
  const ref = useRef<{ getItems: () => BookConfig }>();
  const books = Object.entries(agent.books)
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .sort(([a], [b]) => bookOrder(a) - bookOrder(b));

  return (
    <Card
      title="Books held"
      description={`${fmtCount(booksHeld(agent.books))} books across ${
        books.length
      } subject${books.length === 1 ? "" : "s"}`}
      actions={
        <button
          type="button"
          className={smallButton}
          onClick={() =>
            showAlertDialog({
              title: "Update books",
              confirmLabel: "Save books",
              message: <SubjectSelect ref={ref} defaultValue={agent.books} />,
              onContinue: async () => {
                await agent.updateBooks(ref.current!.getItems());
                Toast.success("Books updated");
              },
            })}
        >
          Update books
        </button>
      }
    >
      {books.length
        ? (
          <div className="flex flex-wrap gap-1.5">
            {books.map(([name, count]) => (
              <span
                key={name}
                className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2 py-1 text-xs"
              >
                {name}
                <b className="tabular-nums">{count}</b>
              </span>
            ))}
          </div>
        )
        : <p className="text-sm text-zinc-500">Not holding any books.</p>}
    </Card>
  );
}

function PendingOrders({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const orders = useOrders(1, {
    limit: 100,
    agent_id: id,
    delivery_status: "pending",
  }).sort((o, o1) => o1.createdAt.getTime() - o.createdAt.getTime());
  const loading = OrderService.instance.loading;

  return (
    <Card
      title="Pending deliveries"
      description={loading
        ? "Loading…"
        : orders.length
        ? `${fmtCount(orders.length)} assigned and not yet delivered`
        : "Nothing waiting to be delivered"}
      actions={orders.length > 0 && (
        <button
          type="button"
          aria-expanded={open}
          className={smallButton}
          onClick={() => setOpen(!open)}
        >
          {open ? "Hide" : "Show"}
          {open
            ? <ChevronUp className="size-3.5" />
            : <ChevronDown className="size-3.5" />}
        </button>
      )}
      bodyClass="flex flex-col gap-3 bg-zinc-50/60 p-4"
    >
      {open && orders.length > 0 &&
        orders.map((order) => (
          <OrderComponent key={order.getUniqueID} order={order} />
        ))}
    </Card>
  );
}

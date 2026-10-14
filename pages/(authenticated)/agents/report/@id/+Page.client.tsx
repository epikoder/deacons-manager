import { useData } from "vike-react/useData";
import { Agent } from "../../../../../src/services/agents.service";
import { useObserver } from "../../../../../@types/observable";
import DeliveryReport from "../../../../../src/components/DeliveryReport";
import { NotFound } from "../../../../../src/components/ui";

export default function () {
  const { agent } = useData<{ agent?: Agent }>();
  if (!agent) {
    return <NotFound what="Agent" back={{ href: "/agents", label: "Agents" }} />;
  }
  return <Report agent={agent} />;
}

function Report({ agent }: { agent: Agent }) {
  useObserver(agent);
  return (
    <DeliveryReport
      title="Delivery report"
      name={agent.name}
      back={{ href: `/agents/profile/${agent.ID}`, label: agent.name }}
      scope={(q) => q.eq("agent_id", agent.ID)}
      earning={(o) => o.deliveryCost ?? 0}
      earningLabel="Delivery charge"
    />
  );
}

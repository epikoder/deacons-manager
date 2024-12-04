import { Fragment, useRef, useState } from "react";
import AgentService, { useAgent } from "../../../services/agents.service";
import Button from "../../../components/Button";
import { navigate } from "vike/client/router";
import { AgentComponent } from "../../../components/Agent.component";
import Input from "../../../components/Input";
import StateComponent from "../../../components/State.component";
import Pagination from "../../../components/Pagination";

export default function () {
  const [page, setPage] = useState(1);
  const agents = useAgent();
  let timeout: ReturnType<typeof setTimeout>;
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className="overflow-scroll h-full">
      <div className="flex justify-between items-center h-[50px] sticky top-0 z-50 bg-transparent backdrop-blur-md px-4">
        <div className="flex items-center gap-4">
          <StateComponent
            onChange={(ev) => {
              AgentService.instance.fetch(1, {
                limit: 100,
                search: ref.current?.value,
                state: ev.currentTarget.value,
              });
            }}
          />
          <Input
            ref={ref}
            className="w-72"
            placeholder="search phone, name..."
            onKeyUp={(ev) => {
              clearTimeout(timeout);
              timeout = setTimeout(() => {
                AgentService.instance.fetch(1, {
                  limit: 100,
                  search: (ev.target as HTMLInputElement).value,
                });
              }, 500);
            }}
            resetSize
          />
        </div>
        <Button
          className="bg-green-500"
          onClick={() => navigate("/agents/new")}
        >
          New Agent
        </Button>
      </div>
      <div className="p-4">
        {agents.map((agent) => (
          <AgentComponent key={agent.ID + new Date().getTime()} agent={agent} />
        ))}
        {agents.isEmpty() && (
          <div className="p-24 text-center">
            Nothing to show
          </div>
        )}
      </div>
      <div className="sticky z-50 bottom-0 py-2 bg-white w-full">
        <Pagination
          onNavigate={(page) => setPage(page)}
          perPage={100}
          total={AgentService.instance.total}
          page={page}
        />
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import AgentService, { useAgent } from "../../../src/services/agents.service";
import { AgentComponent } from "../../../src/components/Agent.component";
import StateComponent from "../../../src/components/State.component";
import Pagination from "../../../src/components/Pagination";
import {
  EmptyState,
  fmtCount,
  PageBody,
  PageHeader,
  primaryButton,
  SearchField,
  selectClass,
} from "../../../src/components/ui";
import { useDebounced } from "../../../src/hooks/useDebounced";

const PER_PAGE = 50;

export default function () {
  const agents = useAgent(false);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [state, setState] = useState("");
  const search = useDebounced(query.trim(), 300);
  const service = AgentService.instance;

  // One fetch for page, search and state together. Each used to fetch on its own
  // and drop the others: picking a state forgot the search, and paging did nothing.
  useEffect(() => {
    service.fetch(page, { limit: PER_PAGE, search, state: state || undefined });
  }, [page, search, state]);

  const filtered = !!(search || state);

  return (
    <PageBody>
      <PageHeader
        title="Agents"
        subtitle={service.loading && agents.length === 0
          ? "Loading…"
          : `${fmtCount(service.total)} ${
            filtered ? "matching " : ""
          }agent${service.total === 1 ? "" : "s"}`}
        actions={<a href="/agents/new" className={primaryButton}>New agent</a>}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchField
          value={query}
          onChange={(v) => {
            setQuery(v);
            setPage(1);
          }}
          placeholder="Search name, phone or email…"
        />
        <StateComponent
          // Controlled: clear the component's built-in defaultValue.
          defaultValue={undefined}
          value={state}
          className={selectClass}
          onChange={(ev) => {
            setState(ev.currentTarget.value);
            setPage(1);
          }}
        />
        {filtered && (
          <button
            type="button"
            className="text-sm text-zinc-500 hover:text-zinc-800"
            onClick={() => {
              setQuery("");
              setState("");
              setPage(1);
            }}
          >
            Clear
          </button>
        )}
      </div>

      <div
        className={`flex flex-col gap-4 transition-opacity ${
          service.loading && agents.length ? "opacity-60" : ""
        }`}
      >
        {agents.map((agent) => (
          <AgentComponent key={agent.ID} agent={agent} />
        ))}
        {service.loading && agents.length === 0 &&
          [0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl border border-zinc-200 bg-white"
            />
          ))}
        {!service.loading && agents.length === 0 && (
          <EmptyState
            title={filtered ? "No agents match" : "No agents yet"}
            hint={filtered
              ? "Try part of the name or the last digits of the phone."
              : "Add one with New agent."}
          />
        )}
      </div>

      <Pagination
        onNavigate={setPage}
        perPage={PER_PAGE}
        total={service.total}
        page={page}
      />
    </PageBody>
  );
}

import { useEffect, useState } from "react";
import AffiliateComponent from "../../../src/components/Affiliate.component";
import AffiliateService, {
  useAffiliates,
} from "../../../src/services/affiliate.service";
import Pagination from "../../../src/components/Pagination";
import {
  EmptyState,
  fmtCount,
  PageBody,
  PageHeader,
  primaryButton,
  SearchField,
} from "../../../src/components/ui";
import { useDebounced } from "../../../src/hooks/useDebounced";

const PER_PAGE = 50;

export default function () {
  const affiliates = useAffiliates(false);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const search = useDebounced(query.trim(), 300);
  const service = AffiliateService.instance;

  // Paging used to change the highlighted page number and nothing else.
  useEffect(() => {
    service.fetch(page, { limit: PER_PAGE, search });
  }, [page, search]);

  return (
    <PageBody>
      <PageHeader
        title="Affiliates"
        subtitle={service.loading && affiliates.length === 0
          ? "Loading…"
          : `${fmtCount(service.total)} ${
            search ? "matching " : ""
          }affiliate${service.total === 1 ? "" : "s"}`}
        actions={
          <a href="/affiliates/new" className={primaryButton}>
            New affiliate
          </a>
        }
      />

      <SearchField
        value={query}
        onChange={(v) => {
          setQuery(v);
          setPage(1);
        }}
        placeholder="Search name, phone or email…"
      />

      <div
        className={`flex flex-col gap-4 transition-opacity ${
          service.loading && affiliates.length ? "opacity-60" : ""
        }`}
      >
        {affiliates.map((v) => <AffiliateComponent key={v.ID} affiliate={v} />)}
        {service.loading && affiliates.length === 0 &&
          [0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl border border-zinc-200 bg-white"
            />
          ))}
        {!service.loading && affiliates.length === 0 && (
          <EmptyState
            title={search ? `No affiliates match “${search}”` : "No affiliates yet"}
            hint={search
              ? "Try part of the name or the last digits of the phone."
              : "Add one with New affiliate."}
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

import { useData } from "vike-react/useData";
import { useObserver } from "../../../../../@types/observable";
import { Affiliate } from "../../../../../src/services/affiliate.service";
import DeliveryReport from "../../../../../src/components/DeliveryReport";
import { NotFound } from "../../../../../src/components/ui";

export default function () {
  const { affiliate } = useData<{ affiliate?: Affiliate }>();
  if (!affiliate) {
    return (
      <NotFound
        what="Affiliate"
        back={{ href: "/affiliates", label: "Affiliates" }}
      />
    );
  }
  return <Report affiliate={affiliate} />;
}

function Report({ affiliate }: { affiliate: Affiliate }) {
  useObserver(affiliate);
  const sources = affiliate.source ?? [];
  return (
    <DeliveryReport
      title="Earnings report"
      name={affiliate.name}
      back={{ href: `/affiliates/profile/${affiliate.ID}`, label: affiliate.name }}
      // Case-insensitive, as the earnings functions are: an order stamped "ella"
      // belongs to source "Ella", and an exact match left it out of the report.
      scope={(q) =>
        q.or(
          sources.map((s) => `source.ilike."${s.replace(/[%_"\\]/g, "")}"`)
            .join(","),
        )}
      // This column used to print the raw number, not naira.
      earning={(o) => o.affiliateEarning}
      earningLabel="Affiliate earning"
      empty={sources.length ? undefined : "This affiliate has no order sources yet."}
    />
  );
}

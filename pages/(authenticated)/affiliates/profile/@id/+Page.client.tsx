import { useData } from "vike-react/useData";
import { useEffect, useState } from "react";
import CopyButton from "../../../../../src/components/CopyButton";
import { useObserver } from "../../../../../@types/observable";
import { PhoneIcon } from "../../../../../src/components/Icons";
import Carbon from "../../../../../src/utils/carbon";
import { Affiliate } from "../../../../../src/services/affiliate.service";
import OrderStatsCharts from "../../../../../src/components/OrderStatsCharts";
import { SourceChips } from "../../../../../src/components/Affiliate.component";
import {
  Card,
  fmtCount,
  NotFound,
  PageBody,
  ProfileHeader,
  secondaryButton,
  StatTile,
} from "../../../../../src/components/ui";

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
  return <AffiliateProfile affiliate={affiliate} />;
}

function AffiliateProfile({ affiliate }: { affiliate: Affiliate }) {
  useObserver(affiliate);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    affiliate.Balance().fetchEarningForYear(year);
  }, [year]);

  const monthName = new Carbon().month;
  const sources = affiliate.source ?? [];

  return (
    <PageBody>
      <ProfileHeader
        back={{ href: "/affiliates", label: "Affiliates" }}
        name={affiliate.name}
        meta={
          <>
            <span className="flex items-center gap-1">
              <a
                href={`tel:${affiliate.phone}`}
                className="flex items-center gap-1.5 text-blue-600 hover:underline tabular-nums"
              >
                <PhoneIcon className="size-3" />
                {affiliate.phone}
              </a>
              <CopyButton value={affiliate.phone} label="Copy phone number" />
            </span>
            {affiliate.email && <span>{affiliate.email}</span>}
          </>
        }
        actions={
          <>
            <a
              href={encodeURI(`/orders?affiliate=${affiliate.ID}`)}
              className={secondaryButton}
            >
              Orders
            </a>
            <a
              href={`/affiliates/report/${affiliate.ID}`}
              className={secondaryButton}
            >
              Earnings report
            </a>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={`Orders in ${monthName}`}
          value={fmtCount(affiliate.totalOrderForCurrentCycle)}
        />
        <StatTile label="All orders" value={fmtCount(affiliate.totalOrders)} />
        <StatTile
          label={`Earned in ${monthName} ${year}`}
          value={affiliate.balance[0].asLocalCurrency()}
        />
        <StatTile
          label={`Earned in ${year}`}
          value={affiliate.balance[1].asLocalCurrency()}
        />
      </div>

      <Card
        title="Order sources"
        description="Orders from these sites count for this affiliate."
      >
        <SourceChips sources={sources} />
      </Card>

      <OrderStatsCharts sources={sources} year={year} onYearChange={setYear} />
    </PageBody>
  );
}

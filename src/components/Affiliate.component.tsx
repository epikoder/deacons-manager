import { useObserver } from "../../@types/observable";
import CopyButton from "./CopyButton";
import { Affiliate } from "../services/affiliate.service";
import Carbon from "../utils/carbon";
import { PhoneIcon } from "./Icons";
import { Avatar, fmtCount, smallButton } from "./ui";

export const SourceChips = ({ sources }: { sources: string[] }) =>
  sources.length
    ? (
      <div className="flex flex-wrap gap-1">
        {sources.map((s) => (
          <span
            key={s}
            className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-[11px] font-medium text-white"
          >
            {s}
          </span>
        ))}
      </div>
    )
    : <span className="text-xs text-zinc-400">No sources</span>;

export default function AffiliateComponent({
  affiliate,
}: {
  affiliate: Affiliate;
}) {
  useObserver(affiliate);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={affiliate.name} />
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <a
                href={`/affiliates/profile/${affiliate.ID}`}
                className="truncate font-semibold text-zinc-900 hover:underline"
              >
                {affiliate.name}
              </a>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 text-sm">
              <span className="flex items-center gap-1">
                <a
                  className="flex items-center gap-1.5 text-blue-600 hover:underline tabular-nums"
                  href={`tel:${affiliate.phone}`}
                >
                  <PhoneIcon className="size-3" />
                  {affiliate.phone}
                </a>
                <CopyButton value={affiliate.phone} label="Copy phone number" />
              </span>
              {affiliate.email && (
                <span className="truncate text-zinc-500">{affiliate.email}</span>
              )}
            </div>
          </div>
        </div>
        <dl className="flex gap-6 text-right">
          <div>
            <dt className="text-xs text-zinc-500">{new Carbon().month}</dt>
            <dd className="text-lg font-semibold tabular-nums text-zinc-900">
              {fmtCount(affiliate.totalOrderForCurrentCycle)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">All orders</dt>
            <dd className="text-lg font-semibold tabular-nums text-zinc-900">
              {fmtCount(affiliate.totalOrders)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Earned this month</dt>
            <dd className="text-lg font-semibold tabular-nums text-zinc-900">
              {affiliate.balance[0].asLocalCurrency()}
            </dd>
          </div>
        </dl>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 px-4 py-3">
        <SourceChips sources={affiliate.source ?? []} />
        <div className="flex-1" />
        <a
          href={encodeURI(`/orders?affiliate=${affiliate.ID}`)}
          className={smallButton}
        >
          Orders
        </a>
        <a href={`/affiliates/profile/${affiliate.ID}`} className={smallButton}>
          Profile
        </a>
      </div>
    </div>
  );
}

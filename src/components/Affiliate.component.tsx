import { useObserver } from "../../@types/observable";
import { Affiliate } from "../services/affiliate.service";
import Carbon from "../utils/carbon";
import { CopyIcon, PhoneIcon } from "./Icons";

export default function AffiliateComponent({
  affiliate,
}: {
  affiliate: Affiliate;
}) {
  useObserver(affiliate);

  return (
    <div
      onClick={() => console.log(affiliate)}
      className="rounded-lg shadow-md"
    >
      <div className="p-4 flex gap-8 justify-between">
        <div>
          <div>{affiliate.name}</div>
          <div className="text-zinc-600">
            <span className="font-semibold text-2xl">
              {Intl.NumberFormat().format(affiliate.totalOrderForCurrentCycle)}
            </span>
            &nbsp;
            <span className="text-xs">{new Carbon().month}</span>
            &nbsp;
            <span>/</span>&nbsp;
            <span>{Intl.NumberFormat().format(affiliate.totalOrders)}</span>
            &nbsp;
            <span className="text-xs">total</span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-3">
            <a
              className="flex gap-2 w-fit items-center"
              href={`tel:${affiliate.phone}`}
            >
              <PhoneIcon className="size-3 text-blue-500" />
              <div>{affiliate.phone}</div>
            </a>
            <button
              className="px-1"
              onClick={() => {
                navigator.clipboard.writeText(affiliate.phone);
                alert("copied!!");
              }}
            >
              <CopyIcon className="size-4" />
            </button>
          </div>
          <div className="font-bold">{affiliate.email}</div>
        </div>
      </div>
      <div className="p-4 relative">
        <div className="right-4 top-2 flex items-center gap-4">
          <a
            href={encodeURI(`/orders?affiliate=${affiliate.ID}`)}
            className="flex-1"
          >
            <div className="text-center text-white bg-blue-500 text-xs rounded-lg whitespace-nowrap px-4 py-1 hover:bg-opacity-75">
              View Orders
            </div>
          </a>
          <a href={`/affiliates/profile/${affiliate.ID}`} className="flex-1">
            <div className="text-center text-white bg-teal-500 text-xs rounded-lg whitespace-nowrap px-4 py-1 hover:bg-opacity-75">
              View Profile
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}

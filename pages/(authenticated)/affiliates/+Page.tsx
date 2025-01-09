import { useRef, useState } from "react";
import AffiliateComponent from "../../../src/components/Affiliate.component";
import AffiliateService, {
  useAffiliates,
} from "../../../src/services/affiliate.service";
import Input from "../../../src/components/Input";
import { navigate } from "vike/client/router";
import Button from "../../../src/components/Button";
import Pagination from "../../../src/components/Pagination";

export default function () {
  const [page, setPage] = useState(1);
  const affiliates = useAffiliates(page);
  let timeout: ReturnType<typeof setTimeout>;

  return (
    <div className="overflow-scroll h-full">
      <div className="flex justify-between items-center h-[50px] sticky top-0 z-50 bg-transparent backdrop-blur-md px-4">
        <div className="flex items-center gap-4">
          <Input
            className="w-72"
            placeholder="search phone, name..."
            onKeyUp={(ev) => {
              clearTimeout(timeout);
              timeout = setTimeout(() => {
                AffiliateService.instance.fetch(1, {
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
          onClick={() => navigate("/affiliates/new")}
        >
          New Affiliate
        </Button>
      </div>
      <div className="p-4">
        {affiliates.map((v) => (
          <AffiliateComponent key={v.ID + new Date().getTime()} affiliate={v} />
        ))}
        {affiliates.isEmpty() && (
          <div className="p-24 text-center">
            Nothing to show
          </div>
        )}
      </div>
      <div className="sticky z-50 bottom-0 py-2 bg-white w-full">
        <Pagination
          onNavigate={(page) => setPage(page)}
          perPage={100}
          total={AffiliateService.instance.total}
          page={page}
        />
      </div>
    </div>
  );
}

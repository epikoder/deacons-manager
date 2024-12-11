import { useData } from "vike-react/useData";
import { useObserver } from "../../../../../@types/observable";
import { useEffect, useRef, useState } from "react";
import { postgrest, WithAuth } from "../../../../../utils/postgrest";
import Carbon from "../../../../../utils/carbon";
import Order from "../../../../../services/orders.service/order";
import printer from "../../../../../utils/printer";
import { Affiliate } from "../../../../../services/affiliate.service";

export default function () {
  const { affiliate } = useData<{ affiliate?: Affiliate }>();
  if (!affiliate) return <div>NOT FOUND</div>;
  useObserver(affiliate);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [month, setMonth] = useState<number | undefined>();
  const tableRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);

  const _get_orders = async () => {
    const LIMIT = 2;
    let range: [number, number] | undefined = [0, 1];
    let result: IOrder[] = [];
    do {
      const query = postgrest.from("orders").select("*", { count: "exact" }).in(
        "source",
        affiliate.source,
      ).not("delivered_on", "is", null).range(...range);
      if (month) {
        query.gte("delivered_on", Carbon.fromMonth(month).formatLocalISO()).lte(
          "delivered_on",
          Carbon.fromMonth(month + 1, 0).formatLocalISO(),
        );
      }

      const { data, error, count } = await new WithAuth(
        query,
      )
        .unwrap();
      if (error) {
        console.error(error);
        break;
      }
      result = result.concat(data);
      if ((range[1] + 1) > count! || count! <= data.length) {
        break;
      }
      range[0] += LIMIT;
      range[1] += LIMIT;
    } while (true);
    setLoading(false);
    setOrders(
      result.map((o) => new Order(o)).sort((a, b) =>
        b.deliveredOn!.getTime() - a.deliveredOn!.getTime()
      ),
    );
  };

  useEffect(() => {
    _get_orders();
  }, [month]);

  return (
    <div className="h-full p-2">
      <center
        ref={titleRef}
        className="p-4 w-fit mx-auto gap-4 items-center"
      >
        <div>Delivered Orders Report for: {affiliate.name}</div>
        <select
          defaultValue={month}
          onChange={(ev) => setMonth(parseInt(ev.currentTarget.value))}
          className="outline-none text-xs w-fit"
        >
          <option
            key={""}
            value={""}
          >
            -- {new Carbon().getFullYear()} --
          </option>
          {Array.from(Array(new Carbon().getMonth()).keys()).map(
            (k) => (
              <option
                key={k}
                value={k + 1}
              >
                {Carbon.monthString(k)}
              </option>
            ),
          )}
        </select>
      </center>

      <div id="print-btn" className="flex justify-end py-2">
        <button
          className="rounded-md px-5 py-1 text-white bg-green-500 text-sm"
          onClick={() => {
            let el = document.createElement("div");
            const ti = titleRef.current!.cloneNode(true);
            (ti as HTMLElement).style.marginBottom = "30px";
            el.append(ti);
            el.append(tableRef.current!.cloneNode(true));
            console.log(el);
            printer(el.cloneNode(true) as HTMLElement);
          }}
        >
          PRINT
        </button>
      </div>
      <div ref={tableRef} className="overflow-y-scroll h-[85vh]">
        <table className="custom-table">
          <thead className="">
            <tr>
              <th>
                ID
              </th>
              <th>
                Item
              </th>
              <th>
                Books
              </th>
              <th>
                Address
              </th>
              <th>
                DeliveredAt
              </th>
              <th>
                Earning
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o, i) => (
              <tr key={o.ID}>
                <td>
                  {i + 1}
                </td>
                <td className="whitespace-nowrap">
                  {o.orderItem}
                </td>
                <td>
                  {Object.entries(o.books ?? {}).map((en) =>
                    `${en[0]}:${en[1]}`
                  ).join(", ")}
                </td>
                <td>
                  {`${o.address}, ${o.state}`}
                </td>
                <td className="whitespace-nowrap">
                  {o.deliveredOn ? o.deliveredOn.format() : "-"}
                </td>
                <td>
                  {o.affiliateEarning}
                </td>
              </tr>
            ))}
            <tr>
              <td>
              </td>
              <td>
              </td>
              <td>
              </td>
              <td>
              </td>
              <td className="font-semibold">
                Total:
              </td>
              <td className="font-semibold">
                {orders.map((o) => o.affiliateEarning).sum().asLocalCurrency()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

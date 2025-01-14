import { useData } from "vike-react/useData";
import Order from "../../../../../src/services/orders.service/order";
import { OrderComponent } from "../../../../../src/components/Order.component";
import { Agent } from "../../../../../src/services/agents.service";
import { useObserver } from "../../../../../@types/observable";
import Carbon from "../../../../../src/utils/carbon";
import Pagination from "../../../../../src/components/Pagination";
import List from "rc-virtual-list";
import { useState } from "react";

export default function () {
  const { orders, agent } = useData<{ orders: Order[]; agent?: Agent }>();
  if (!agent) return <div>NOT FOUND</div>;
  useObserver(agent);
  const [page, setPage] = useState(1);

  return (
    <div className="overflow-scroll h-full">
      <div className="sticky top-0 z-50 bg-white p-4">
        <div>{agent.name}</div>
        <div>
          <span className="font-semibold text-2xl">
            {agent.totalOrderForCurrentCycle}
          </span>
          &nbsp;
          <span className="text-xs">{new Carbon().month}</span>
          &nbsp;<span>/</span>&nbsp;
          <span>{agent.totalOrders}</span>&nbsp;
          <span className="text-xs">total</span>
        </div>
      </div>
      <List
        className="p-4"
        data={orders
          .sort(
            (o, o1) =>
              (o.isAssignedToAgent ? 1 : 0) - (o1.isAssignedToAgent ? 1 : 0),
          )
          .sort((o, o1) => o.deliveryStatusWeight - o1.deliveryStatusWeight)}
        itemKey="id"
      >
        {(order, key) => <OrderComponent key={order.ID} order={order} />}
      </List>
      <div className="sticky z-50 bottom-0 py-2 bg-white w-full">
        <Pagination
          onNavigate={(page) => setPage(page)}
          perPage={100}
          total={agent.totalOrders}
          page={page}
        />
      </div>
    </div>
  );
}

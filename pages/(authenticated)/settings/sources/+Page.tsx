import OrderService from "../../../../src/services/orders.service/orders.service";
import { useOrders } from "../../../../src/services/orders.service/hook";

export default function () {
    useOrders();
    return (
        <div className="flex flex-col gap-3 text-sm py-4 w-fit">
            {OrderService.instance.sources.map(([name, uri], idx) => (
                <div
                    key={idx}
                    className="grid gap-4 grid-cols-6 py-1 px-2 rounded-md bg-zinc-100"
                >
                    <div className="col-span-2">
                        {name}
                    </div>
                    <div className="col-span-4">
                        <a href={uri} target="_blank" rel="noopener noreferrer">
                            {uri}
                        </a>
                    </div>
                </div>
            ))}
        </div>
    );
}

export { useOrders };

import { useEffect, useState } from "react";
import Order from "./order";
import OrderService from "./orders.service";

const useOrders = (...args: Parameters<OrderService["fetchOrders"]>) => {
    const [orders, setOrders] = useState<Order[]>([]);
    useEffect(() => {
        const orderService = OrderService.instance;
        const handleOrdersChange = (newOrders: Order[]) => {
            setOrders(newOrders);
        };
        orderService.subscribe(handleOrdersChange);
        setOrders(orderService.orders);
        orderService.fetchOrders(...args);
        return () => {
            orderService.unsubscribe(handleOrdersChange);
        };
    }, []);
    return orders;
};

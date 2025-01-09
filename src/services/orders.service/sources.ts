import { formatQuery } from "../../utils/helper";
import { OrderItem } from "./order";

export { sourceUsingJambWaec };

const sourceUsingJambWaec = (url: string): OrderSource => {
    const generateItemAndAmount = (
        v: { jamb_waec: string },
    ): Pick<IOrder, "item" | "order_amount"> => {
        if (!v.jamb_waec) return { item: OrderItem.none, order_amount: 0 };
        let item: OrderItem;
        if (v.jamb_waec.includes("jamb") && v.jamb_waec.includes("waec")) {
            if (v.jamb_waec.includes("science")) {
                item = OrderItem.jambWaecScience;
            } else if (v.jamb_waec.includes("art")) {
                item = OrderItem.jambWaecArt;
            } else {
                item = OrderItem.jambWaecCommercial;
            }
        } else if (v.jamb_waec.includes("jamb")) {
            if (v.jamb_waec.includes("science")) {
                item = OrderItem.jambScience;
            } else if (v.jamb_waec.includes("art")) {
                item = OrderItem.jambArt;
            } else {
                item = OrderItem.jambCommercial;
            }
        } else {
            if (v.jamb_waec.includes("science")) {
                item = OrderItem.waecScience;
            } else if (v.jamb_waec.includes("art")) {
                item = OrderItem.waecArt;
            } else {
                item = OrderItem.waecCommercial;
            }
        }
        const amount = parseInt(
            v.jamb_waec.split("@")[1].replace(",", "").trim(),
        );
        return { item: item, order_amount: amount };
    };

    return async (param: SearchParam) => {
        let results: Omit<IOrder, "source">[] = [];
        let isNotEndOfList = false;
        let page = 0;
        do {
            const rs = await fetch(formatQuery(url, param));
            if (rs.status != 200) {
                throw new Error(await rs.text());
            }
            const orders = await rs.json();
            const _data = (orders as any[]).map((v) => ({
                id: v.id,
                address: v.address,
                created_at: v.created_at,
                email: v.email,
                fullname: v.fullname,
                phone: v.phone,
                state: v.state.includes("cross") ? "Cross River" : v.state,
                ...generateItemAndAmount(v),
            } satisfies Awaited<ReturnType<OrderSource>>[number]));
            results = results.concat(_data);
            isNotEndOfList = param.limit <= _data.length;
            page++;
            param.offset = page * param.limit;
        } while (isNotEndOfList);
        return results;
    };
};

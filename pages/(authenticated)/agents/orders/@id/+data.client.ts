import { PageContextServer } from "vike/types";
import { postgrest, WithAuth } from "../../../../../src/utils/postgrest";
import Order from "../../../../../src/services/orders.service/order";
import { Agent } from "../../../../../src/services/agents.service";

export const data = async (pageContext: PageContextServer) => {
    const [{ data }, { data: agent }] = await Promise.all([
        new WithAuth(
            postgrest.from("orders")
                .select(`*,agents(*)`)
                .eq(
                    "agent_id",
                    pageContext.routeParams.id,
                )
                .order("created_at", {
                    ascending: false,
                }).limit(50),
        ).unwrap(),
        new WithAuth(
            postgrest.from("agents")
                .select()
                .eq(
                    "id",
                    pageContext.routeParams.id,
                ).single(),
        ).unwrap(),
    ]);

    return {
        orders: (data ?? []).map((o: IOrder) => new Order(o)),
        agent: agent ? new Agent(agent) : undefined,
    };
};

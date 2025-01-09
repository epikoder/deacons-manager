import { PageContextClient } from "vike/types";
import { postgrest, WithAuth } from "../../../../../src/utils/postgrest";
import { Agent } from "../../../../../src/services/agents.service";

export const data = async (pageContext: PageContextClient) => {
    const { data: agent } = await new WithAuth(
        postgrest.from("agents")
            .select()
            .eq(
                "id",
                pageContext.routeParams.id,
            ).single(),
    ).unwrap();

    return {
        agent: agent ? new Agent(agent) : undefined,
    };
};

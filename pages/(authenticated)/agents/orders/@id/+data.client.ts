import { PageContextClient } from "vike/types";
import { postgrest, WithAuth } from "../../../../../src/utils/postgrest";
import { Agent } from "../../../../../src/services/agents.service";

// Orders are fetched by the page through OrderService, so paging and the status
// filter work and edits refresh the list; this loads only the agent.
export const data = async (pageContext: PageContextClient) => {
    const { data: agent } = await new WithAuth(
        postgrest.from("agents")
            .select()
            .eq("id", pageContext.routeParams.id)
            .single(),
    ).unwrap();

    return { agent: agent ? new Agent(agent) : undefined };
};

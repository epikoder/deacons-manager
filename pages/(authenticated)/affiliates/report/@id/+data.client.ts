import { PageContextClient } from "vike/types";
import { postgrest, WithAuth } from "../../../../../utils/postgrest";
import { Affiliate } from "../../../../../services/affiliate.service";

export const data = async (pageContext: PageContextClient) => {
    const { data: affiliate } = await new WithAuth(
        postgrest.from("affiliates")
            .select()
            .eq(
                "id",
                pageContext.routeParams.id,
            ).single(),
    ).unwrap();

    return {
        affiliate: affiliate ? new Affiliate(affiliate) : undefined,
    };
};
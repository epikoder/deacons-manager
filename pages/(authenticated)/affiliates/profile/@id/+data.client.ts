import { PageContextServer } from "vike/types";
import { postgrest, WithAuth } from "../../../../../src/utils/postgrest";
import { Affiliate } from "../../../../../src/services/affiliate.service";

export const data = async (pageContext: PageContextServer) => {
    const { data } = await new WithAuth(
        postgrest.from("affiliates")
            .select()
            .eq(
                "id",
                pageContext.routeParams.id,
            ).single(),
    ).unwrap();

    return { affiliate: data ? new Affiliate(data) : undefined };
};

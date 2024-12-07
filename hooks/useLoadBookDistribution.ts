import { postgrest, WithAuth } from "../utils/postgrest";

export const useLoadBookDistribution = (agent_id?: string) => {
    return async () => {
        const { data } = await new WithAuth(
            postgrest.rpc("get_books_distribution"),
        ).unwrap();
        return data ?? [];
    };
};

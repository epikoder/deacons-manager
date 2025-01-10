export { guardClient };
import { AUTH_KEY } from "./auth";
import type { PageContextClient } from "vike/types";
import { navigate } from "vike/client/router";
import { postgrest, WithAuth } from "./postgrest";
import OrderService from "../services/orders.service/orders.service";

// https://github.com/vikejs/vike/issues/1916
// wka
const guardClient = (
  context: PageContextClient,
  onRenderClient: (pageContext: PageContextClient) => void,
) => {
  if (context.urlPathname == "/login") {
    return onRenderClient(context);
  }

  const userString = sessionStorage.getItem(AUTH_KEY + "_user");

  const authString = sessionStorage.getItem(AUTH_KEY);
  if (!authString || !userString) {
    navigate("/login");
    return;
  }

  const u = JSON.parse(userString) as User;
  context.config.ready = true;
  context.config.user = u;
  context.isHydration = false;

  new WithAuth(
    postgrest.from("configs").select().eq("name", "book_cost").single(),
  ).unwrap().then(async ({ data, error }) => {
    let cost = data?.value ? parseInt(data?.value) : 1200;
    isNaN(cost) && (cost = 1200);

    if (error) {
      new WithAuth(
        postgrest.from("configs").upsert({
          name: "book_cost",
          value: cost,
          type: "number",
        }),
      ).unwrap();
    }
    context.config.bookCost = cost;
    OrderService.instance.costPerBook = cost;
    onRenderClient(context); // Render client
  });
};

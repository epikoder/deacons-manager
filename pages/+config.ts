import vikeReact from "vike-react/config";
import type { Config } from "vike/types";

// Default config (can be overridden by pages)
// https://vike.dev/config

export default {
  // https://vike.dev/head-tags
  description: "Deacon's Publishers | Dashboard",
  extends: vikeReact,
  meta: {
    bookCost: {
      env: {
        server: true,
        client: true,
      },
    },
  },
} satisfies Config;

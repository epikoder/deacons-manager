import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import vike from "vike/plugin";
import fs from "fs";

let cert: string | undefined;
let key: string | undefined;
if (
  fs.existsSync("./certs/cert.pem") && process.env.NODE_ENV != "development"
) {
  cert = fs.readFileSync("./certs/cert.pem", "utf8");
  key = fs.readFileSync("./certs/private.pem", "utf8");
}

let pgrestURL = process.env.PG_REST ?? "http://localhost:3001";

export default defineConfig({
  plugins: [vike({}), react({})],
  server: {
    https: cert
      ? {
        cert,
        key,
      }
      : undefined,
    proxy: {
      "/rest": {
        target: pgrestURL,
        rewrite: (path) => path.replace("/rest", ""),
      },
    },
  },
});

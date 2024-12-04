import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import vike from "vike/plugin";
import fs from "fs";

let cert: string | undefined;
let key: string | undefined;
if (fs.existsSync("./certs/cert.pem")) {
  cert = fs.readFileSync("./certs/cert.pem", "utf8");
  key = fs.readFileSync("./certs/private.pem", "utf8");
}

export default defineConfig({
  plugins: [vike({}), react({})],
  server: cert
    ? {
      https: {
        cert,
        key,
      },
    }
    : undefined,
});

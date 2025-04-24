import { edenFetch } from "@elysiajs/eden";
import { Elysia } from "elysia";
import path from "node:path";
import { toolsApi } from "./api/tools";
import { Config } from "./config";
import { aiAPI } from "./api/ai";
import { ui } from "./api/_ui";

const port = Bun.env.PORT ? parseInt(Bun.env.PORT) : 3000;

const app = new Elysia({
  // Extend the idle timeout to the maximum allowed by the server
  serve: { idleTimeout: 255 }
})
  .use(toolsApi)
  .use(aiAPI)
  .use(ui)
  .listen(port);

export const fetch = edenFetch<typeof app>(app.server!.url.toString());

console.log(
  `Your .workspace at ${path.relative(process.cwd(), Config.WORKSPACE_PATH)} is running at ${app.server?.hostname}:${app.server?.port}`
);

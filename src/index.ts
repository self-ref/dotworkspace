import { Elysia } from "elysia";
import path from "node:path";
import { toolsApi } from "./api/tools";
import { Config } from "./config";

const app = new Elysia()
  .use(toolsApi)
  .listen(3000);

console.log(
  `Your .workspace at ${path.relative(process.cwd(), Config.WORKSPACE_PATH)} is running at ${app.server?.hostname}:${app.server?.port}`
);

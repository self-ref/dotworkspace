import Elysia, { t } from "elysia";
import path from "node:path";
import { Config } from "../../config";
import { ToolRunStatusSchema } from "./_schemas";

export const getToolRun = new Elysia()
  .get('/tools/:toolName/runs/:runId', async ({ params }) => {
    return Bun.file(`${path.join(Config.WORKSPACE_PATH, params.toolName, 'runs', params.runId, 'status.json')}`).json();
  }, {
    params: t.Object({
      toolName: t.String({ description: 'The name of the tool' }),
      runId: t.String({ description: 'The ID of the run' }),
    }),
    response: ToolRunStatusSchema,
  });

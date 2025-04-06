import Elysia, { t } from "elysia";
import path from "node:path";
import { Config } from "../../config";

export const getToolRunLogs = new Elysia()
  .get('/tools/:toolName/runs/:runId/logs', async ({ params }) => {
    return Bun.file(`${path.join(Config.WORKSPACE_PATH, params.toolName, 'runs', params.runId, 'logs.txt')}`).text();
  }, {
    params: t.Object({
      toolName: t.String({ description: 'The name of the tool' }),
      runId: t.String({ description: 'The ID of the run' }),
    }),
    response: t.String({ description: 'The logs of the tool run' }),
  });

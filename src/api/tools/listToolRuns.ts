import { $ } from "bun";
import Elysia, { t } from "elysia";
import { Config } from "../../config";
import type { ToolRunStatus } from "./_schemas";

export const listToolRuns = new Elysia()
  .get('/tools/:toolName/runs', async ({ params }) => {
    let toolRunStatusPromises: Promise<ToolRunStatus>[] = [];

    // Get the specs of all tools
    for await (const toolRunStatusPath of $`ls ${Config.WORKSPACE_PATH}/${params.toolName}/runs/*/status.json`.lines()) {
      if (!toolRunStatusPath.length) continue;
      toolRunStatusPromises.push(Bun.file(toolRunStatusPath).json());
    }

    // Wait for all the specs to be resolved
    const toolRunStatuses = await Promise.all(toolRunStatusPromises);

    // Return the tool specs
    return toolRunStatuses;
  }, {
    params: t.Object({
      toolName: t.String({ description: 'The name of the tool' }),
    }),
  });

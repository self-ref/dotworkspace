import { $ } from "bun";
import Elysia, { t } from "elysia";
import path from "node:path";
import { Config } from "../../config";

export const deleteToolRun = new Elysia()
  .delete('/tools/:toolName/runs/:runId', async ({ params: { toolName, runId } }) => {
    // Check that the tool exists
    const toolDirList = await $`ls ${path.join(Config.WORKSPACE_PATH, toolName)}`;
    if (toolDirList.exitCode !== 0) {
      return Response.json({ error: 'Tool not found' }, { status: 404 });
    }

    // Check that the run exists
    const runDirList = await $`ls ${path.join(Config.WORKSPACE_PATH, toolName, 'runs', runId)}`;
    if (runDirList.exitCode !== 0) {
      return Response.json({ error: 'Run not found' }, { status: 404 });
    }

    // Delete the tool
    await $`rm -rf ${path.join(Config.WORKSPACE_PATH, toolName, 'runs', runId)}`;
    
    // Return a success message
    return { message: 'Tool run deleted' };
  }, {
    params: t.Object({
      toolName: t.String({ description: 'The name of the tool' }),
      runId: t.String({ description: 'The ID of the run' }),
    }),
  });

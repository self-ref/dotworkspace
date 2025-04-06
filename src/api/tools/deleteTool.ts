import { $ } from "bun";
import Elysia, { t } from "elysia";
import path from "node:path";
import { Config } from "../../config";

export const deleteTool = new Elysia()
  .delete('/tools/:toolName', async ({ params: { toolName } }) => {
    // Check that the tool exists
    const toolDirList = await $`ls ${path.join(Config.WORKSPACE_PATH, toolName)}`;
    if (toolDirList.exitCode !== 0) {
      return Response.json({ error: 'Tool not found' }, { status: 404 });
    }

    // Delete the tool
    await $`rm -rf ${path.join(Config.WORKSPACE_PATH, toolName)}`;
    
    // Return a success message
    return { message: 'Tool deleted' };
  }, {
    params: t.Object({
      toolName: t.String({ description: 'The name of the tool to delete' }),
    }),
  });

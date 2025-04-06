import Elysia, { t } from "elysia";
import path from "node:path";
import { Config } from "../../config";

export const getTool = new Elysia()
  .get('/tools/:toolName', async ({ params: { toolName } }) => {
    // Get the tool
    const tool = await Bun.file(path.join(Config.WORKSPACE_PATH, toolName, 'spec.json')).json();
    
    // Return the tool
    return tool;
  }, {
    params: t.Object({
      toolName: t.String({ description: 'The name of the tool to get' }),
    }),
  });

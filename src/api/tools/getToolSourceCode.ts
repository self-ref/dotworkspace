import Elysia, { t } from "elysia";
import path from "node:path";
import { Config } from "../../config";

export const getToolSourceCode = new Elysia()
  .get('/tools/:toolName/sourceCode', async ({ params: { toolName } }) => {
    // Get the tool
    const tool = await Bun.file(path.join(Config.WORKSPACE_PATH, toolName, 'main.ts')).text();
    
    // Return the tool
    return tool;
  }, {
    params: t.Object({
      toolName: t.String({ description: 'The name of the tool' }),
    }),
  });

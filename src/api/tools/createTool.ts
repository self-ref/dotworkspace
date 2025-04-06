import { $ } from "bun";
import Elysia, { t } from "elysia";
import path from "node:path";
import { Config } from "../../config";
import { ToolSchema } from "./_schemas";

export const createTool = new Elysia()
  .post('/tools', async ({ body: { tool, sourceCode } }) => {
    // Make the directory
    await $`mkdir -p ${path.join(Config.WORKSPACE_PATH, tool.name)}`;
    
    // Write the source code
    Bun.write(`${path.join(Config.WORKSPACE_PATH, tool.name, 'main.ts')}`, sourceCode);

    // Write the tool to spec.json
    await Bun.write(`${path.join(Config.WORKSPACE_PATH, tool.name, 'spec.json')}`, JSON.stringify(tool, null, 2));
    
    // Return the tool with a 201 status code (created)
    return Response.json(tool, { status: 201 });
  }, {
    body: t.Object({
      tool: ToolSchema,
      sourceCode: t.String({ description: 'The source code of the tool' }),
    }),
  });

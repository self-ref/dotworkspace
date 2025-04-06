import { $ } from "bun";
import Elysia from "elysia";
import { Config } from "../../config";
import type { Tool } from "./_schemas";

export const listTools = new Elysia()
  .get('/tools', async () => {
    let toolSpecPromises: Promise<Tool>[] = [];

    // Get the specs of all tools
    for await (const toolSpecPath of $`ls ${Config.WORKSPACE_PATH}/*/spec.json`.lines()) {
      if (!toolSpecPath.length) continue;
      toolSpecPromises.push(Bun.file(toolSpecPath).json());
    }

    // Wait for all the specs to be resolved
    const tools = await Promise.all(toolSpecPromises);

    // Return the tool specs
    return tools;
  });

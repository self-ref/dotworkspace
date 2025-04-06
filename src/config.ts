import { $ } from "bun";
import path from "node:path";
import { parseArgs } from "node:util";

// Parse the command line arguments
const args = parseArgs({
  args: process.argv.slice(2),
  options: {
    workspacePath: { type: 'string', short: 'w' },
  },
});

/** The configuration for the .workspace server */
export const Config = {
  /** The path to the workspace directory */
  WORKSPACE_PATH: await $`echo ${args.values.workspacePath!}`.text(),
};

// Ensure the workspace path exists
await $`mkdir -p ${Config.WORKSPACE_PATH}`;
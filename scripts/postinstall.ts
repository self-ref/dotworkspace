import { $ } from "bun";
import path from "node:path";

// If the DISABLE_AUTO_INSTALL environment variable is set to 1, skip enabling auto-install
if (process.env.DISABLE_AUTO_INSTALL === '1') process.exit(0);

// Remove the node_modules directory to ensure auto-install is enabled
await $`rm -rf ${path.resolve(import.meta.dirname, '../', 'node_modules')}`;
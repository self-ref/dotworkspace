import { $ } from "bun";
import Elysia, { t } from "elysia";
import path from "node:path";
import { Config } from "../../config";
import type { ToolRunStatus } from "./_schemas";

export const runTool = new Elysia()
  .post('/tools/:toolName/runs', async function* runTool({ params: { toolName }, body: { runId, input } }) {
    // Get the tool directory
    const toolDirPath = path.join(Config.WORKSPACE_PATH, toolName);

    // Ensure the tool directory exists
    if ((await $`ls ${toolDirPath}`).exitCode !== 0) {
      console.error(`[${runId}] - Tool directory does not exist: ${toolDirPath}`);
      process.exit(1);
    }

    // Get tool paths
    const toolMainFilePath = path.join(toolDirPath, 'main.ts');
    const toolSpecFilePath = path.join(toolDirPath, 'spec.json');
    // Get the tool run paths
    const toolRunDirPath = path.join(toolDirPath, 'runs', runId);
    const toolRunLogsFilePath = path.join(toolRunDirPath, 'logs.txt');
    // Create tool run directory
    await $`mkdir -p ${toolRunDirPath}`;
    // Create tool run logs file
    await $`touch ${toolRunLogsFilePath}`;

    try {
      // Get the tool spec
      /** @type { { input: any, output: any } } */
      const toolSpec = await Bun.file(toolSpecFilePath).json();

      // TODO: Validate the input against the tool spec

      // Import the tool function
      const { default: toolFn } = await import(toolMainFilePath) as { default: (input: any) => AsyncGenerator<string, any> };
      
      // Run the tool
      const toolGenerator = toolFn(input);

      // Write the status of the tool run
      await writeToolRunStatusFile(toolName, runId, {
        runId,
        status: "running",
      });

      // Manual iteration to properly capture the return value
      let iterResult = await toolGenerator.next();
      
      // Process each yielded value until done
      while (!iterResult.done) {
        const message = iterResult.value;

        // Concurrently log and emit the message
        yield formatMessage(runId, message);
        await handleToolRunMessage(toolName, runId, message);
        
        // Get the next value
        iterResult = await toolGenerator.next();
      }
      
      // When done, the return value is available in the final result's value
      const result = iterResult.value;

      // Concurrently write and emit the result
      yield formatResult(runId, result);
      await handleToolRunResult(toolName, runId, result);

      // return result;
    } catch (error) {
      console.error(`[${runId}] - Error:`, error);
      // Concurrently log and emit the error
      yield formatError(runId, error as Error);
      await handleToolRunError(toolName, runId, error as Error);
    }

  }, {
    params: t.Object({
      toolName: t.String({ description: 'The name of the tool' }),
    }),
    body: t.Object({
      runId: t.String({ description: 'The ID of the new run' }),
      input: t.Optional(t.Any({ description: 'The input to the tool' })),
    }),
  });

// –
// Helpers
// –
async function getToolRunLogsFile(toolName: string, runId: string) {
  return path.join(Config.WORKSPACE_PATH, toolName, 'runs', runId, 'logs.txt');
}

async function getToolRunStatusFile(toolName: string, runId: string) {
  return path.join(Config.WORKSPACE_PATH, toolName, 'runs', runId, 'status.json');
}

async function writeToolRunStatusFile(toolName: string, runId: string, status: ToolRunStatus) {
  await Bun.write(
    await getToolRunStatusFile(toolName, runId),
    JSON.stringify(status, null, 2),
  );
}

async function handleToolRunError(toolName: string, runId: string, error: Error) {
  // Get the tool run logs file
  const toolRunLogsFile = await getToolRunLogsFile(toolName, runId);

  await Promise.all([
    // Write the error to the tool run logs file
    $`echo "${formatError(runId, error)}" >> ${toolRunLogsFile}`,
    // Emit the error
    Bun.write(Bun.stdout, `${formatError(runId, error)}\n`),
    // Write the error to the tool run status file
    writeToolRunStatusFile(toolName, runId, {
      runId,
      status: "failed",
      error: {
        name: error.name,
        message: error.message,
        stack: 'stack' in error ? error.stack : undefined,
      },
    }),
  ]);
}

function formatError(runId: string, error: Error) {
  const data = {
    name: error.name,
    message: error.message,
    cause: error.cause,
    stack: error.stack,
  };

  return `[${runId}] error: ${JSON.stringify(data)}`;
}

async function handleToolRunMessage(toolName: string, runId: string, message: string) {
  // Get the tool run logs file
  const toolRunLogsFile = await getToolRunLogsFile(toolName, runId);

  await Promise.all([
    // Write the message to the tool run logs file
    $`echo "${formatMessage(runId, message)}" >> ${toolRunLogsFile}`,
    // Emit the message
    Bun.write(Bun.stdout, `${formatMessage(runId, message)}\n`)
  ]);
}

function formatMessage(runId: string, message: string) {
  return `[${runId}] message: ${message}`;
}

async function handleToolRunResult(toolName: string, runId: string, result: unknown) {
  // Get the tool run logs file
  const toolRunLogsFile = await getToolRunLogsFile(toolName, runId);

  await Promise.all([
    // Write the result to the tool run logs file
    $`echo "${formatResult(runId, result)}" >> ${toolRunLogsFile}`,
    // Emit the result
    Bun.write(Bun.stdout, `${formatResult(runId, result)}\n`),
    // Write the result to the tool run status file
    writeToolRunStatusFile(toolName, runId, {
      runId,
      status: "completed",
      result,
    }),
  ]);
}

function formatResult(runId: string, result: unknown) {
  return `[${runId}] result: ${JSON.stringify(result)}`;
}

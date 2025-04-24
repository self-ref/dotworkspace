import Ajv from "ajv";
import { $ } from "bun";
import Elysia, { t } from "elysia";
import path from "node:path";
import { Config } from "../../config";
import { formatToolLog } from "../../lib/protocol/format";
import type { ToolRunStatus } from "./_schemas";

// Create Ajv instance for schema validation
const ajv = new Ajv({ allErrors: true });

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

      // Validate the input against the tool spec
      if (toolSpec.input) {
        const validate = ajv.compile(toolSpec.input);
        const valid = validate(input);
        
        if (!valid) {
          const errors = validate.errors || [];
          const errorMessage = formatValidationErrors(errors);
          throw new Error(`Invalid tool input: ${errorMessage}`, { 
            cause: { 
              errors, 
              input,
              schema: toolSpec.input 
            } 
          });
        }
      }

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

        // Format the message with detailed information
        const formattedMessage = formatToolLog(runId, 'message', message);
        
        // Log the message
        console.log(formattedMessage);

        // Yield the message with a specific format that's easier to parse
        yield `${formattedMessage}\n`;
        
        // Also write to the log file
        await handleToolRunMessage(toolName, runId, message);
        
        // Get the next value
        iterResult = await toolGenerator.next();
      }
      
      // When done, the return value is available in the final result's value
      const result = iterResult.value;

      // Validate the output against the tool spec
      if (toolSpec.output) {
        const validate = ajv.compile(toolSpec.output);
        const valid = validate(result);
        
        if (!valid) {
          const errors = validate.errors || [];
          const errorMessage = formatValidationErrors(errors);
          throw new Error(`Invalid tool output: ${errorMessage}`, { 
            cause: { 
              errors, 
              result,
              schema: toolSpec.output 
            } 
          });
        }
      }

      // Log and handle the result
      console.log(formatToolLog(runId, 'result', result));
      await handleToolRunResult(toolName, runId, result);

      yield formatToolLog(runId, 'result', result);
    } catch (error) {
      // Emit and handle the error
      yield `${formatToolLog(runId, 'error', error as Error)}\n`;
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
    $`echo "${formatToolLog(runId, 'error', error)}" >> ${toolRunLogsFile}`,
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

async function handleToolRunMessage(toolName: string, runId: string, message: string) {
  // Get the tool run logs file
  const toolRunLogsFile = await getToolRunLogsFile(toolName, runId);
  // Write the message to the tool run logs file
  await $`echo "${formatToolLog(runId, 'message', message)}" >> ${toolRunLogsFile}`;
}

async function handleToolRunResult(toolName: string, runId: string, result: unknown) {
  // Get the tool run logs file
  const toolRunLogsFile = await getToolRunLogsFile(toolName, runId);
  // Concurrently write the result to the tool run logs file and status file
  await Promise.all([
    $`echo "${formatToolLog(runId, 'result', result)}" >> ${toolRunLogsFile}`,
    writeToolRunStatusFile(toolName, runId, {
      runId,
      status: "completed",
      result,
    }),
  ]);
}

// Helper function to format validation errors
function formatValidationErrors(errors: any[]): string {
  return errors.map(err => {
    const path = err.instancePath || '';
    const prop = err.params?.property || '';
    const message = err.message || 'validation error';
    
    if (err.keyword === 'required') {
      return `Missing required property: '${prop}'`;
    }
    
    return `${path}${prop ? '.' + prop : ''} ${message}`;
  }).join('; ');
}

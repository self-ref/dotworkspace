import type { DataStreamWriter } from "ai";
import { fetch } from "../../..";
import { parseToolLog, processToolLogsBuffer } from "../../protocol/format";
import { createToolLogger } from "./createToolLogger";

/**
 * Options for tool execution
 */
export type ToolExecutionOptions = {
  runId?: string;
  abortSignal?: AbortSignal;
};

/**
 * Creates a tool executor function
 */
export function createToolExecutor(toolName: string, dataStream?: DataStreamWriter) {
  return async (args: any, options: ToolExecutionOptions = {}) => {
    // Use provided ID or generate a unique one
    const runId = options.runId || `tool-${Date.now()}`;
    const logger = createToolLogger(runId, toolName, dataStream);

    try {
      // Run the tool
      const { data: toolStream, error } = await fetch(`/tools/:toolName/runs`, {
        method: 'POST',
        params: { toolName },
        body: {
          runId,
          input: args
        }
      });

      if (error || !toolStream) {
        throw new Error(`Failed to execute tool: ${error?.message || 'Unknown error'}`);
      }

      // Processing state
      let buffer = '';
      let finalResult: any = null;

      // Process the streaming output
      for await (const chunk of toolStream) {
        buffer += chunk;
        const { entries, remainder } = processToolLogsBuffer(buffer);
        buffer = remainder;

        // Process each log entry
        for (const entry of entries) {
          if (entry.kind === 'message') {
            logger.progress(entry.content);
          } else if (entry.kind === 'result') {
            finalResult = entry.content;
            logger.result(entry.content);
          } else if (entry.kind === 'error') {
            logger.error(entry.content);
          }
        }
      }

      // Process any remaining content
      if (buffer.trim()) {
        const entry = parseToolLog(buffer.trim());
        if (entry?.kind === 'result') {
          finalResult = entry.content;
          logger.result(entry.content);
        }
      }

      return finalResult;
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error));
      throw error;
    }
  };
} 
import type { DataStreamWriter } from "ai";
import { jsonSchema, tool } from "ai";
import { fetch } from "../../..";
import { createToolLogger } from "./createToolLogger";

/**
 * Creates the built-in tool for deleting tools
 */
export function createToolDeleter(dataStream?: DataStreamWriter) {
  return tool({
    description: "Delete a custom tool",
    parameters: jsonSchema({
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name of the tool to delete"
        }
      },
      required: ["name"]
    }),
    execute: async (args, options) => {
      const runId = options?.toolCallId || `delete-${Date.now()}`;
      const logger = createToolLogger(runId, 'delete_tool', dataStream);
      
      try {
        // Type assertion to access properties
        const { name } = args as { name: string };
        
        if (!name) {
          throw new Error("Tool name is required");
        }
        
        logger.progress(`Deleting tool "${name}"...`);
        
        const { error } = await fetch(`/tools/:toolName`, {
          method: 'DELETE',
          params: { toolName: name }
        });
        if (error) throw error;
        
        const result = {
          success: true,
          deletedTool: name,
          message: `Tool "${name}" deleted successfully`
        };
        
        logger.result(result);
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(errorMessage);
        
        return {
          success: false,
          message: `Failed to delete tool: ${errorMessage}`
        };
      }
    }
  });
} 
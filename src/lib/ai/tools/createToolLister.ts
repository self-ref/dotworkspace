import type { DataStreamWriter } from "ai";
import { jsonSchema, tool } from "ai";
import { fetch } from "../../..";
import { createToolLogger } from "./createToolLogger";

/**
 * Creates the built-in tool for listing tools
 */
export function createToolLister(dataStream?: DataStreamWriter) {
  return tool({
    description: "List all available tools",
    parameters: jsonSchema({}),
    execute: async (_args, options) => {
      const runId = options?.toolCallId || `list-${Date.now()}`;
      const logger = createToolLogger(runId, 'list_tools', dataStream);
      
      try {
        logger.progress("Fetching available tools...");
        
        const { data: tools, error } = await fetch('/tools', {});
        
        if (error) {
          throw error;
        }
        
        // Add built-in tools to the list
        const builtInTools = [
          { name: 'create_tool', description: 'Create a new custom tool' },
          { name: 'list_tools', description: 'List all available tools' },
          { name: 'delete_tool', description: 'Delete a custom tool' }
        ];
        
        const allTools = [
          ...tools,
          ...builtInTools
        ];
        
        logger.progress(`Found ${allTools.length} tools (${tools.length} custom, ${builtInTools.length} built-in)`);
        logger.result(allTools);
        
        return allTools;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(errorMessage);
        
        return {
          success: false,
          message: `Failed to list tools: ${errorMessage}`
        };
      }
    }
  });
} 
import type { DataStreamWriter } from "ai";
import { jsonSchema, tool } from "ai";
import { fetch } from "../../..";
import { createToolLogger } from "./createToolLogger";
import { generateUsageExamples } from "./generateUsageExamples";

/**
 * Creates the built-in tool for creating new tools
 */
export function createToolCreator(dataStream?: DataStreamWriter) {
  return tool({
    description: "Create a new custom tool with the given source code",
    parameters: jsonSchema({
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name of the tool (alphanumeric with dashes)"
        },
        description: {
          type: "string",
          description: "Description of what the tool does"
        },
        sourceCode: {
          type: "string",
          description: "JavaScript/TypeScript source code for the tool"
        }
      },
      required: ["name", "description", "sourceCode"]
    }),
    execute: async (args, options) => {
      const runId = options?.toolCallId || `create-${Date.now()}`;
      const logger = createToolLogger(runId, 'create_tool', dataStream);
      
      try {
        // Type assertion to access the expected properties
        const { name, description, sourceCode } = args as { 
          name: string;
          description: string;
          sourceCode: string;
        };
        
        if (!name || !description || !sourceCode) {
          throw new Error("Missing required parameters");
        }
        
        logger.progress(`Creating tool "${name}"...`);
        
        // // Step 1: Generate schemas
        // logger.progress("Generating input and output schemas");
        // let schemas;
        // try {
        //   schemas = await generateSchemas(
        //     name, 
        //     description, 
        //     sourceCode,
        //     msg => logger.progress(msg)
        //   );
        // } catch (schemaError) {
        //   logger.error(`Failed to generate schemas: ${schemaError instanceof Error ? schemaError.message : String(schemaError)}`);
        //   throw new Error("Schema generation failed", { cause: schemaError });
        // }
        
        // Step 2: Generate examples
        logger.progress("Generating usage examples");
        let examples;
        try {
          examples = await generateUsageExamples(
            name,
            description,
            sourceCode,
            msg => logger.progress(msg)
          );
        } catch (exampleError) {
          logger.error(`Failed to generate examples: ${exampleError instanceof Error ? exampleError.message : String(exampleError)}`);
          throw new Error("Example generation failed", { cause: exampleError });
        }
        
        // Step 3: Create the tool
        logger.progress("Saving tool to database");
        const { data, error } = await fetch('/tools', {
          method: 'POST',
          body: {
            tool: {
              name,
              description,
              // inputSchema: schemas.inputSchema,
              // outputSchema: schemas.outputSchema,
              usageExamples: examples
            },
            sourceCode
          }
        });
        
        if (error) {
          throw error;
        }
        
        const result = {
          success: true,
          tool: {
            name,
            description,
            exampleCount: examples.length
          },
          message: `Tool "${name}" created successfully`
        };
        
        logger.result(result);
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(errorMessage);
        
        return {
          success: false,
          message: `Failed to create tool: ${errorMessage}`
        };
      }
    }
  });
} 
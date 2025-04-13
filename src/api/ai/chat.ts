import { type CoreMessage, createDataStreamResponse, type DataStreamWriter, jsonSchema, streamText, tool } from "ai";
import Elysia, { t } from "elysia";
import { fetch } from "../../index";
import { type LanguageModelName, providerRegistry } from "./_providerRegistry";

/**
 * Options passed to tool execution functions by the AI SDK.
 */
interface ToolExecutionOptions {
  toolCallId?: string;
  abortSignal?: AbortSignal;
  /** The messages array being processed, allowing modification (e.g., adding annotations). */
  messages?: CoreMessage[];
}

export const chat = new Elysia()
  .post('/ai/chat', async ({ body: { modelName, input } }) => {
    // Create a data stream response compliant with the Vercel AI SDK protocol.
    return createDataStreamResponse({
    execute: async (dataStream) => {
      // Dynamically create the tool set, passing the dataStream for annotation writing.
      const tools = await createToolSet(dataStream);

      // Initiate the text streaming with the OpenAI model, messages, and tools.
      const result = streamText({
        model: providerRegistry.languageModel(modelName),
        system: `You are a helpful assistant that can use tools to help the user. You can use multiple tools in parallel, and you can use the same tool multiple times if needed. You can also use the same tool to answer different questions.

You can use the following tools:
${Object.keys(tools).map(tool => `- ${tool}`).join('\n')}

When creating a new tool, make sure to include a clear description of what the tool does, and a natural language example of how to use the tool.

Here's an example tool:

/* To create a tool, you need to export a default function that yields strings (intermediate status messages) and returns the final result.
 * 
 * The function will receive the input as an argument and can yield any number of messages to the caller.
 * 
 * The caller will receive the final result of the function.
 */
export default async function* _example({ name }: { name: string }): AsyncGenerator<string, string> {
  yield \`I am about to greet the user. User name is \${name}\`;
  return \`Hello, \${name}!\`;
}

Yielded messages will be displayed to the user as they are generated. They act as status updates for the user, explaining what the tool is doing.
The return value of the function will be displayed to the user as the final result of the tool call.
`,
        messages: input.messages,
        tools
      });

      // Merge the AI SDK's stream (including text, tool calls/results) into our response stream.
      result.mergeIntoDataStream(dataStream);
    },
    // Handle any errors during stream generation.
    onError: (error) => {
      console.error('Error in chat data stream:', error);
      // Return a sanitized error message to the client.
      return error instanceof Error ? error.message : 'An unexpected error occurred';
    }
  });
  }, {
    body: t.Object({
      modelName: t.String({ default: 'openai:gpt-4o-mini' }),
      input: t.Object({
        messages: t.Array(t.Any()),
      }),
    }),
  });

// –
// Helpers
// –

/**
 * Creates the set of tools available to the AI, including dynamic user-defined tools
 * and static built-in tools.
 * @param dataStream - The Vercel AI SDK DataStreamWriter instance to write annotations to.
 * @returns An object representing the tool set compatible with the AI SDK.
 */
async function createToolSet(dataStream?: DataStreamWriter) {
  const { data: userTools, error } = await fetch('/tools', {});

  if (error || userTools instanceof Response) {
    throw new Error('Failed to fetch user tools', { cause: error ?? new Error("GET /tools response data is not a valid JSON object") });
  }

  // Define tools using the 'tool' function from the AI SDK.
  return {
    // Dynamic user-defined tools fetched from the database.
    ...Object.fromEntries(
      userTools.map((userTool) => [
        userTool.name,
        tool({
          description: userTool.description,
          parameters: jsonSchema(userTool.inputSchema as any),
          /**
           * Executes the user-defined tool.
           * This function iterates through the tool's potentially streaming output
           * and writes progress annotations to the data stream.
           */
          execute: async (args: any, options: ToolExecutionOptions) => {
            // Ensure a unique ID for this tool call, used for correlating annotations.
            const toolCallId = options.toolCallId || `tool-${userTool.name}-${Date.now()}`;

            // Obtain the tool's implementation.
            const { data: toolGenerator } = await fetch('/tools/:toolName/runs', {
              method: 'POST',
              params: {
                toolName: userTool.name,
              },
              body: {
                input: args,
                runId: toolCallId,
              },
            });

            if (!toolGenerator) {
              throw new Error('Failed to fetch tool generator');
            }

            let iterResult = await toolGenerator.next();

            // Process intermediate messages yielded by the tool generator.
            while (!iterResult.done) {
              const message = iterResult.value;

              // If a dataStream is available (meaning we're streaming the response),
              // write annotations for tool progress.
              if (dataStream) {
                // Create the annotation payload.
                const annotation = {
                  // Use a namespaced key to avoid conflicts.
                  tool_progress: {
                    toolCallId,
                    toolName: userTool.name,
                    message, // The message yielded by the tool.
                    timestamp: new Date().toISOString()
                  }
                };

                // Write a message annotation part (type 8) to the stream.
                // This allows associating progress updates with the current assistant message.
                dataStream.writeMessageAnnotation(annotation);
              }

              // Advance the tool's generator.
              iterResult = await toolGenerator.next();
            }

            // The generator is done, iterResult.value contains the final return value.
            const finalResult = iterResult.value;

            // Optionally, send a final annotation indicating completion (though the standard
            // tool_result part sent by streamText might be sufficient).
            if (dataStream) {
              dataStream.writeMessageAnnotation({ tool_completion: { toolCallId, toolName: userTool.name, timestamp: new Date().toISOString() } });
            }

            // Return the final result to the AI SDK.
            // The SDK will internally create a 'tool_result' message based on this
            // to send back to the LLM in the next turn.
            return finalResult;
          }
        })
      ])
    ),

    // Static, built-in tools for managing the tool server itself.
    list_tools: tool({
      description: "List all available tools (user-defined and static).",
      parameters: jsonSchema({}), // No parameters needed.
      execute: async (_args: any, options: ToolExecutionOptions) => {
        const { data: userTools, error } = await fetch('/tools', {});
        if (error || userTools instanceof Response) {
          throw new Error('Failed to fetch tools from database', { cause: error ?? new Error("GET /tools response data is not a valid JSON object") });
        }
        // Combine DB tools with the names/descriptions of static tools.
        const staticTools = [
          { name: 'list_tools', description: 'List all available tools (user-defined and static).' },
          { name: 'delete_tool', description: 'Delete a user-defined tool by name.' },
          { name: 'create_tool', description: 'Create a new user-defined tool.' },
        ];
        const allTools = [...userTools.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema, usageExamples: t.usageExamples })), ...staticTools];
        return allTools;
      }
    }),

    delete_tool: tool({
      description: "Delete a user-defined tool by name.",
      parameters: jsonSchema({
        type: "object",
        properties: {
          toolName: {
            type: "string",
            description: "The exact name of the user-defined tool to delete."
          }
        },
        required: ["toolName"]
      }),
      execute: async (args: any, options: ToolExecutionOptions) => {
        // Ensure args has the expected structure before accessing properties
        const toolName = args?.toolName;
        if (typeof toolName !== 'string') {
          return { success: false, message: 'Invalid or missing toolName argument.' };
        }
        console.log(`Attempting to delete tool: ${toolName}`);
        const { data: deletedTool, error } = await fetch('/tools/:toolName', {
          method: 'DELETE',
          params: {
            toolName,
          },
        });

        if (error || deletedTool instanceof Response) {
          throw new Error('Failed to delete tool', { cause: error ?? new Error("DELETE /tools/:toolName response data is not a valid JSON object") });
        }

        return { success: true, deleted: deletedTool, message: `Tool '${toolName}' deleted.` };
      }
    }),

    create_tool: tool({
      description: "Create a new user-defined tool.",
      parameters: jsonSchema({
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The name for the new tool (alphanumeric, dashes allowed)."
          },
          description: {
            type: "string",
            description: "A clear description of what the tool does."
          },
          sourceCode: {
            type: "string",
            description: "The source code of the tool."
          }
        },
        required: ["name", "description", "sourceCode"]
      }),
      execute: async (args: any, options: ToolExecutionOptions) => {
        // Add validation for required args properties
        const { name, description, sourceCode } = args || {};
        if (!name || !description || !sourceCode) {
          return { success: false, message: 'Missing required arguments for create_tool.' };
        }

//         dataStream?.writeMessageAnnotation({
//           tool_progress: {
//             toolName: 'create_tool',
//             message: `Generating JSON schemas for tool ${name}...`,
//             timestamp: new Date().toISOString()
//           }
//         });
//         const { object: { inputSchema } } = await generateObject({
//           model: providerRegistry.languageModel('openai:gpt-4o-mini'),
//           system: `You are a JSON schema expert who accurately extracts parameter types from AsyncGenerator functions.`,
//           prompt: `Analyze this tool function and generate an accurate JSON schema for its input parameters:

// Tool name: ${name}
// Description: ${description}
// Source code:
// \`\`\`
// ${sourceCode}
// \`\`\`

// Focus on extracting the parameters the function accepts.

// Examples of proper schemas:
// 1. If function accepts no parameters: 
//    {}

// 2. If function accepts a single string parameter: 
//    {"type": "object", "properties": {"text": {"type": "string"}}, "required": ["text"]}

// 3. If function accepts multiple parameters:
//    {"type": "object", "properties": {"name": {"type": "string"}, "count": {"type": "number"}}, "required": ["name", "count"]}

// DO NOT return an empty object ({}) unless the function genuinely takes no parameters!`,
//           schema: z.object({
//             inputSchema: z.object({})
//           })
//         });

//         dataStream?.writeMessageAnnotation({
//           tool_progress: {
//             toolName: 'create_tool',
//             message: `Generating example usage for tool ${name}...`,
//             timestamp: new Date().toISOString()
//           }
//         });
//         const { object: { exampleUsage } } = await generateObject({
//           model: providerRegistry.languageModel('openai:gpt-4o-mini'),
//           system: `You are a tool documentation expert who provides clear, concise examples of inputs and outputs.`,
//           prompt: `Create a simple example that shows exactly what input is given to the tool and what output the user can expect.

// Tool name: ${name}
// Description: ${description}
// Input schema:
// \`\`\`
// ${inputSchema}
// \`\`\`

// Source code:
// \`\`\`
// ${sourceCode}
// \`\`\`

// Format your response like this:
// Input: {what goes into the tool, matching the parameter structure}
// Output: {what the tool returns as its final result}

// Keep it simple and focused on one clear example. Do NOT include any explanatory text, code snippets, or yield statements.`,
//           schema: z.object({
//             exampleUsage: z.string(),
//           })
//         });

        dataStream?.writeMessageAnnotation({
          tool_progress: {
            toolName: 'create_tool',
            message: `Creating tool ${name}...`,
            timestamp: new Date().toISOString()
          }
        });
        try {
          const { data: newTool, error } = await fetch('/tools', {
            method: 'POST',
            body: {
              tool: {
                name,
                description,
                // inputSchema,
                // outputSchema,
                // usageExamples,
              },
              sourceCode,
            },
          });
          if (error || newTool instanceof Response) {
            throw new Error('Failed to create tool', { cause: error ?? new Error("POST /tools response data is not a valid JSON object") });
          }
          return { success: true, created: newTool, message: `Tool '${name}' created.` };
        } catch (error) {
          console.error(`Error creating tool: ${name}`, error);
          return { success: false, message: `Error creating tool: ${name}` };
        }
      }
    })
  };
}

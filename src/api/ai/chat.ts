import type { CoreMessage, DataStreamWriter } from "ai";
import { createDataStreamResponse, jsonSchema, streamText, tool } from "ai";
import Elysia, { t } from "elysia";
import { fetch } from "../../index";
import type { LanguageModelName } from "../../lib/ai/providerRegistry";
import { providerRegistry } from "../../lib/ai/providerRegistry";
import { createToolCreator } from "../../lib/ai/tools/createToolCreator";
import { createToolDeleter } from "../../lib/ai/tools/createToolDeleter";
import { createToolExecutor } from "../../lib/ai/tools/createToolExecutor";

/**
 * Options passed to tool execution functions by the AI SDK
 */
interface ToolExecutionOptions {
  /** Unique ID for this specific tool call */
  toolCallId?: string;
  /** Signal that can be used to abort the operation */
  abortSignal?: AbortSignal;
  /** The messages array being processed, allowing modification */
  messages?: CoreMessage[];
}

/**
 * Creates a chat API endpoint that supports streaming responses and tool usage
 */
export const chat = new Elysia()
  .post('/ai/chat', async ({ body: { modelName, input } }) => {
    // Create a data stream response compliant with the Vercel AI SDK protocol
    return createDataStreamResponse({
      execute: async (dataStream) => {
        // Create the tool set with access to the dataStream for progress updates
        const tools = await createToolSet(dataStream);
  
        // Stream text using the specified model, system prompt, and tools
        const result = streamText({
          model: providerRegistry.languageModel(modelName as LanguageModelName),
          system: getSystemPrompt(Object.keys(tools)),
          messages: input.messages,
          tools
        });
  
        // Merge the AI SDK's stream into our response stream
        result.mergeIntoDataStream(dataStream);
      },
      onError: (error) => {
        console.error('Error in chat data stream:', error);
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

/**
 * Generates the system prompt for the AI assistant
 * 
 * @param toolNames - Names of the available tools
 * @returns The system prompt with tool usage instructions
 */
function getSystemPrompt(toolNames: string[]): string {
  return `You are a helpful assistant that can use tools to help the user. You can use multiple tools in parallel, and you can use the same tool multiple times if needed. You can also use the same tool to answer different questions.

You can use the following tools:
${toolNames.map(tool => `- ${tool}`).join('\n')}

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
The return value of the function will be displayed to the user as the final result of the tool call.`;
}

/**
 * List tools tool implementation
 */
function createToolLister(dataStream?: DataStreamWriter) {
  return tool({
    description: "List all available tools (user-defined and static).",
    parameters: jsonSchema({}),
    execute: async (_args: any, options: ToolExecutionOptions) => {
      const toolCallId = options.toolCallId || `list-${Date.now()}`;
      
      // Send progress update
      if (dataStream) {
        dataStream.writeMessageAnnotation({
          tool_progress: {
            toolCallId,
            toolName: 'list_tools',
            message: 'Fetching available tools...',
            timestamp: new Date().toISOString()
          }
        });
      }
      
      // Fetch user tools
      const { data: userTools, error } = await fetch('/tools', {});
      
      if (error || userTools instanceof Response) {
        throw new Error('Failed to fetch tools', { 
          cause: error ?? new Error("GET /tools response data is not a valid JSON object") 
        });
      }
      
      // Define static tools
      const staticTools = [
        { name: 'list_tools', description: 'List all available tools (user-defined and static).' },
        { name: 'delete_tool', description: 'Delete a user-defined tool by name.' },
        { name: 'create_tool', description: 'Create a new user-defined tool.' },
      ];
      
      // Combine all tools
      const allTools = [
        ...userTools.map((t: any) => ({ 
          name: t.name, 
          description: t.description, 
          inputSchema: t.inputSchema, 
          usageExamples: t.usageExamples 
        })), 
        ...staticTools
      ];
      
      // Send result
      if (dataStream) {
        dataStream.writeMessageAnnotation({
          tool_completion: {
            toolCallId,
            toolName: 'list_tools',
            timestamp: new Date().toISOString()
          }
        });
      }
      
      return allTools;
    }
  });
}

/**
 * Creates the set of tools available to the AI, including dynamic user-defined tools
 * and static built-in tools.
 * 
 * @param dataStream - The DataStreamWriter instance for sending annotations
 * @returns An object containing all available tools
 */
async function createToolSet(dataStream?: DataStreamWriter) {
  // Fetch user-defined tools from the database
  const { data: userTools, error } = await fetch('/tools', {});

  if (error || userTools instanceof Response) {
    throw new Error('Failed to fetch user tools', { 
      cause: error ?? new Error("GET /tools response data is not a valid JSON object") 
    });
  }

  // Create a mapping of user-defined tools
  const userToolsMap = Object.fromEntries(
    userTools.map((userTool: any) => [
      userTool.name,
      tool({
        description: `${userTool.description}

--

Please be mindful of the example usage when specifying parameters to the tool. This is very important. These are good examples:
        
Example usage:
\`\`\`
${userTool.usageExamples}
\`\`\`

`,
        parameters: jsonSchema(userTool.inputSchema as any),
        execute: createToolExecutor(userTool.name, dataStream)
      })
    ])
  );

  // Return combined tools (user-defined + built-in)
  return {
    // User-defined tools
    ...userToolsMap,
    
    // Built-in tools
    list_tools: createToolLister(dataStream),
    delete_tool: createToolDeleter(dataStream),
    create_tool: createToolCreator(dataStream)
  };
}

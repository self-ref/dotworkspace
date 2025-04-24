import { generateObject, generateText, jsonSchema, NoObjectGeneratedError } from "ai";
import { providerRegistry } from "../providerRegistry";

/**
 * Generate usage examples for a tool
 */
export async function generateUsageExamples(
  name: string,
  description: string,
  sourceCode: string,
  onProgress?: (message: string) => void
) {
  onProgress?.("Generating usage examples...");
  
  const model = providerRegistry.languageModel("openai:o3-mini");
  
  const prompt = `
Create usage examples for this JavaScript/TypeScript tool function.

Tool code:
\`\`\`
${sourceCode}
\`\`\`

Tool name: ${name}
Tool description: ${description}

Create at least 2 practical usage examples, each with:
- 'description': Concise explanation of the example invocation
- 'input': Input matching the parameter structure (use {} if no parameters)
- 'result': Expected return value given the input

Do not include code in your examples, as it is not important. What your examples demonstrate is the output for an example input, for illustrative purposes when instructing an LLM to use the tool.

Your examples should demonstrate different ways the tool can be used.
`;

  const { text: examples } = await generateText({
    model,
    messages: [{ role: "user", content: prompt }],
    maxRetries: 3,
  });
  
  onProgress?.("Successfully generated examples");
  return examples;
}

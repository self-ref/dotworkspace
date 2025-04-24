import { generateObject, jsonSchema, NoObjectGeneratedError } from "ai";
import type { AnySchemaObject } from "ajv";
import { providerRegistry } from "../providerRegistry";

/**
 * Generate input and output schemas for a tool
 */
export async function generateSchemas(
  name: string, 
  description: string, 
  sourceCode: string,
  onProgress?: (message: string) => void
) {
  onProgress?.("Generating input and output schemas...");
  
  const model = providerRegistry.languageModel("openai:o3-mini");
  
  const prompt = `
Analyze this JavaScript/TypeScript tool function and create JSON schemas for its parameters and return value.

Tool code:
\`\`\`
${sourceCode}
\`\`\`

Tool name: ${name}
Tool description: ${description}

Create two JSON Schema objects:
1. INPUT_SCHEMA - For function parameters
2. OUTPUT_SCHEMA - For function return value

Return your response as a single JSON object:
{
  "inputSchema": { /* JSON Schema object */ },
  "outputSchema": { /* JSON Schema object */ }
}

DO NOT include any explanation text outside the JSON. Your response MUST be a valid JSON schema object.

For example, if the tool function is:
\`\`\`
function add({ a, b }: { a: number, b: number }): number {
  return a + b;
}
\`\`\`

Your response should be:
{
  "inputSchema": {
    "type": "object",
    "properties": {
      "a": { "type": "number" },
      "b": { "type": "number" }
    },
    "required": ["a", "b"]
  },
  "outputSchema": { "type": "number" }
}
`;

  try {
    const { object: schemas } = await generateObject({
      model,
      messages: [{ role: "user", content: prompt }],
      schema: JSON_SCHEMAS_SCHEMA,
      maxRetries: 3,
      mode: 'tool'
    });
    
    onProgress?.("Successfully generated schemas");
    
    return schemas;
  } catch (error) {
    console.error('Error generating schemas', error);
    onProgress?.(`Error generating schemas: ${error instanceof Error ? error.message : String(error)}`);
    if (NoObjectGeneratedError.isInstance(error)) {
      console.log('NoObjectGeneratedError');
      console.log('Cause:', error.cause);
      console.log('Text:', error.text);
      console.log('Response:', error.response);
      console.log('Usage:', error.usage);
    }
    throw error;
  }
}

// –
// JSON Schemas
// –

/** A JSON Schema for validating JSON Schemas */
const JSON_SCHEMA_SCHEMA = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "type": {
      "anyOf": [
        { "type": "string" },
        {
          "type": "array",
          "items": { "type": "string" },
          "uniqueItems": true
        }
      ]
    },
    "properties": {
      "type": "object",
      "additionalProperties": { "$ref": "#" }
    },
    "required": {
      "type": "array",
      "items": { "type": "string" },
      "uniqueItems": true
    },
    "items": {
      "anyOf": [
        { "$ref": "#" },
        {
          "type": "array",
          "items": { "$ref": "#" }
        }
      ]
    },
    "enum": {
      "type": "array"
    },
    "const": {},
    "minimum": { "type": "number" },
    "maximum": { "type": "number" },
    "minLength": { "type": "integer", "minimum": 0 },
    "maxLength": { "type": "integer", "minimum": 0 },
    "pattern": { "type": "string" }
  },
  "additionalProperties": false
};

/** The type of the generated JSON Schemas object */
type JSONSchemas = {
  inputSchema: AnySchemaObject;
  outputSchema: AnySchemaObject;
}

/** The JSON Schema for validating generated JSON Schemas */
const JSON_SCHEMAS_SCHEMA = jsonSchema<JSONSchemas>({
  type: 'object',
  properties: {
    inputSchema: JSON_SCHEMA_SCHEMA,
    outputSchema: JSON_SCHEMA_SCHEMA
  },
  required: ['inputSchema', 'outputSchema'],
  additionalProperties: false
});

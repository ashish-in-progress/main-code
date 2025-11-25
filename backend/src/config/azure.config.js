import { z } from 'zod';
export function extractInstanceName(endpoint) {
  const match = endpoint.match(/https:\/\/([^.]+)\.openai\.azure\.com/);
  console.log(match)
  return match ? match[1] : 'your-resource';
}

export function createZodSchemaFromMCP(mcpSchema) {
  
  const properties = mcpSchema.properties || {};
  const required = mcpSchema.required || [];

  const zodObject = {};

  for (const [key, value] of Object.entries(properties)) {
    let zodField;

    switch (value.type) {
      case 'string':
        zodField = z.string();
        break;
      case 'number':
        zodField = z.number();
        break;
      case 'boolean':
        zodField = z.boolean();
        break;
      case 'array':
        zodField = z.array(z.string());
        break;
      case 'object':
        zodField = z.object({});
        break;
      default:
        zodField = z.string();
    }

    if (value.description) {
      zodField = zodField.describe(value.description);
    }

    if (!required.includes(key)) {
      zodField = zodField.optional();
    }

    zodObject[key] = zodField;
  }

  return z.object(zodObject);
}
import dotenv from 'dotenv';
dotenv.config();

export const PORT = process.env.PORT || 5000;
export const IN_PROD = process.env.NODE_ENV === 'production';
console.log("hi",process.env.PORT )
// Azure OpenAI Configuration for Fyers
export const AZURE_CONFIG_FYERS = {
  endpoint: process.env.AZURE_OPENAI_ENDPOINT || "https://your-resource.openai.azure.com/",
  apiKey: process.env.AZURE_OPENAI_API_KEY || "your-api-key",
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
  apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview"
};

// Azure OpenAI Configuration for Kite/Upstox
export const AZURE_CONFIG_KITE = {
  endpoint: "https://codestore-ai.openai.azure.com/",
  apiKey: "EvkhikwvmvJYbqnV175XrD7C1ym5yXEsYAb5nEz4mbf2BJPXNWeHJQQJ99BJACHYHv6XJ3w3AAABACOGQydk",
  deployment: "gpt-4o",
  apiVersion: "2024-12-01-preview"
};

// Upstox OAuth Configuration
export const UPSTOX_CONFIG = {
  apiKey: 'a5d645f8-c31e-4afd-82c7-296ac6b332fd',
  apiSecret: 'mprx3irvh2',
  redirectUri: 'http://localhost:5000/api/auth/callback',
  authUrl: 'https://api.upstox.com/v2/login/authorization/dialog',
  tokenUrl: 'https://api.upstox.com/v2/login/authorization/token',
  baseUrl: 'https://api.upstox.com/v2'
};

// CORS Origins
export const CORS_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'https://33trpk9t-5173.inc1.devtunnels.ms'
];
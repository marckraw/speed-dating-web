import dotenv from "dotenv";
import { z } from "zod";

// Load environment variables from .env file
dotenv.config();

// Define a schema for environment variables
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.string().default("3000"),
  DATABASE_URL: z.string(),
  ANTHROPIC_API_KEY: z.string(),
  OPENAI_API_KEY: z.string(),
  OPENROUTER_API_KEY: z.string(),
  ELEVENLABS_API_KEY: z.string(),
  LEONARDOAI_API_KEY: z.string(),
  FIGMA_API_KEY: z.string(),
  GEMINI_API_KEY: z.string(),
  X_API_KEY: z.string(),
  LOG_LEVEL: z.string(),
  TODOIST_API_TOKEN: z.string().default(""),
  FIRECRAWL_API_KEY: z.string().default(""),
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),
  AWS_REGION: z.string(),
  S3_BUCKET_NAME: z.string(),
  GITHUB_TOKEN: z.string().default(""),
  HQ_SLACK_SECRET: z.string().default(""),
  SLACK_BOT_URL: z.string().default(""),
  STORYBLOK_OAUTH_TOKEN: z.string().default(""),
  STORYBLOK_ACCESS_TOKEN: z.string().default(""),
  // Qdrant Vector Database Configuration
  QDRANT__SERVICE__URL: z.string(),
  QDRANT__SERVICE__PORT: z.string().default("443"),
  QDRANT__SERVICE__API_KEY: z.string().optional(),
});

// Parse and validate environment variables
const env = envSchema.safeParse(process.env);

if (!env.success) {
  console.error(
    "❌ Invalid environment variables:",
    JSON.stringify(env.error.format(), null, 4)
  );
  process.exit(1);
}

export const config = env.data;

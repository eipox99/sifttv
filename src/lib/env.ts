import { z } from "zod";

const envSchema = z.object({
  TWITCH_CLIENT_ID: z.string().min(1).optional(),
  TWITCH_CLIENT_SECRET: z.string().min(1).optional(),
  TWITCH_REDIRECT_URI: z.string().url().optional(),
  DATABASE_URL: z.string().min(1).optional(),
  AUTH_SECRET: z.string().min(1).optional(),
  REDIS_URL: z.string().url().optional(),
  STREAMLINK_BIN: z.string().min(1).default("streamlink"),
  FFMPEG_BIN: z.string().min(1).default("ffmpeg"),
  INLINE_REFRESH_JOBS: z.enum(["true", "false"]).default("true"),
  TWITCH_MAX_CRAWL_PAGES: z.coerce.number().int().min(0).default(0)
});

function optionalEnv(value: string | undefined) {
  return value && value.trim().length > 0 ? value : undefined;
}

export const env = envSchema.parse({
  TWITCH_CLIENT_ID: optionalEnv(process.env.TWITCH_CLIENT_ID),
  TWITCH_CLIENT_SECRET: optionalEnv(process.env.TWITCH_CLIENT_SECRET),
  TWITCH_REDIRECT_URI: optionalEnv(process.env.TWITCH_REDIRECT_URI),
  DATABASE_URL: optionalEnv(process.env.DATABASE_URL),
  AUTH_SECRET: optionalEnv(process.env.AUTH_SECRET),
  REDIS_URL: optionalEnv(process.env.REDIS_URL),
  INLINE_REFRESH_JOBS: process.env.INLINE_REFRESH_JOBS,
  TWITCH_MAX_CRAWL_PAGES: process.env.TWITCH_MAX_CRAWL_PAGES
});

export function hasTwitchClientCredentials() {
  return Boolean(env.TWITCH_CLIENT_ID && env.TWITCH_CLIENT_SECRET);
}

export function hasDatabaseUrl() {
  return Boolean(env.DATABASE_URL);
}

export function hasRedisUrl() {
  return Boolean(env.REDIS_URL);
}

export function inlineRefreshJobsEnabled() {
  return env.INLINE_REFRESH_JOBS === "true";
}

export function hasAuthRuntimeConfig() {
  return hasTwitchClientCredentials() && Boolean(env.AUTH_SECRET);
}

import type { NextConfig } from "next";

function parseHost(value?: string | null) {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).hostname;
  } catch {
    return value.trim() || null;
  }
}

// Derive the dev-server allowed origins from env so the host is configured in
// one place (.env) instead of hardcoded here. AUTH_URL/APP_URL contribute their
// hostname automatically; DEV_ORIGINS is an optional comma-separated list for
// anything extra (e.g. a LAN IP).
const extraOrigins = (process.env.DEV_ORIGINS ?? "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

const allowedDevOrigins = Array.from(
  new Set(
    [
      "localhost",
      "127.0.0.1",
      parseHost(process.env.AUTH_URL),
      parseHost(process.env.APP_URL),
      ...extraOrigins
    ].filter((value): value is string => Boolean(value))
  )
);

const nextConfig: NextConfig = {
  typedRoutes: true,
  outputFileTracingRoot: process.cwd(),
  allowedDevOrigins,
  devIndicators: {
    position: "top-right"
  }
};

export default nextConfig;

/** @type {import("next").NextConfig} */

function parseHost(value) {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).hostname;
  } catch {
    return value.trim() || null;
  }
}

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
    ].filter(Boolean)
  )
);

const nextConfig = {
  typedRoutes: true,
  outputFileTracingRoot: process.cwd(),
  allowedDevOrigins,
  devIndicators: {
    position: "top-right"
  }
};

export default nextConfig;

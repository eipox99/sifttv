import { NextRequest } from "next/server";

import { handlers } from "@/lib/auth";
import { hasAuthRuntimeConfig } from "@/lib/env";
import { jsonError } from "@/lib/http";

export async function GET(request: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  if (!hasAuthRuntimeConfig()) {
    return jsonError("Sign-in requires Twitch credentials and AUTH_SECRET.", 503);
  }

  return handlers.GET(request);
}

export async function POST(request: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  if (!hasAuthRuntimeConfig()) {
    return jsonError("Sign-in requires Twitch credentials and AUTH_SECRET.", 503);
  }

  return handlers.POST(request);
}

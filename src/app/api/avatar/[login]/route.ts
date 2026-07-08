import { NextRequest, NextResponse } from "next/server";

import { getProfileImageUrl } from "@/lib/twitch";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ login: string }> }
) {
  const { login } = await context.params;

  try {
    const imageUrl = await getProfileImageUrl(login);
    if (!imageUrl) {
      return new NextResponse(null, { status: 404 });
    }

    const response = await fetch(imageUrl, { cache: "no-store" });
    if (!response.ok) {
      return new NextResponse(null, { status: 502 });
    }

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") ?? "image/png";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, s-maxage=3600"
      }
    });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}

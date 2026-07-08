import { spawn } from "node:child_process";

import { jsonError } from "@/lib/http";
import { FFMPEG_BINARY, isValidTwitchLogin, resolveStreamlinkQuality, STREAMLINK_BINARY } from "@/lib/streamlink";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ login: string }> }) {
  const { login } = await context.params;

  if (!isValidTwitchLogin(login)) {
    return jsonError("Invalid channel name.", 400);
  }

  const url = new URL(request.url);
  const specifier = resolveStreamlinkQuality(url.searchParams.get("quality"));
  const enableLowLatency = url.searchParams.get("mpegts_ll") !== "0";

  const streamlinkArgs = [
    `https://www.twitch.tv/${login}`,
    specifier,
    "--stdout",
    "--hls-live-edge",
    "1"
  ];
  if (enableLowLatency) {
    streamlinkArgs.push("--twitch-low-latency");
  }

  const streamlink = spawn(
    STREAMLINK_BINARY,
    streamlinkArgs,
    { stdio: ["ignore", "pipe", "pipe"] }
  );

  // Twitch now serves fMP4/CMAF segments, which mpegts.js cannot parse. Remux
  // (copy, no transcode) to MPEG-TS with low-delay flags so latency stays minimal.
  const ffmpeg = spawn(
    FFMPEG_BINARY,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-fflags",
      "nobuffer",
      "-flags",
      "low_delay",
      "-probesize",
      "1000000",
      "-analyzeduration",
      "1000000",
      "-i",
      "pipe:0",
      "-c",
      "copy",
      "-f",
      "mpegts",
      "-flush_packets",
      "1",
      "pipe:1"
    ],
    { stdio: ["pipe", "pipe", "pipe"] }
  );

  streamlink.stdout.pipe(ffmpeg.stdin);

  let stderr = "";
  const captureStderr = (chunk: Buffer) => {
    if (stderr.length < 4096) {
      stderr += chunk.toString();
    }
  };
  streamlink.stderr.on("data", captureStderr);
  ffmpeg.stderr.on("data", captureStderr);

  // Killing one side can trigger EPIPE on the pipe; swallow those.
  streamlink.stdout.on("error", () => {});
  ffmpeg.stdin.on("error", () => {});

  let killed = false;
  const killAll = () => {
    if (killed) {
      return;
    }
    killed = true;
    try {
      streamlink.kill("SIGKILL");
    } catch {
      // already gone
    }
    try {
      ffmpeg.kill("SIGKILL");
    } catch {
      // already gone
    }
  };

  const output = ffmpeg.stdout;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const closeOnce = () => {
        if (closed) {
          return;
        }
        closed = true;
        try {
          controller.close();
        } catch {
          // stream already closed
        }
        killAll();
      };

      output.on("data", (chunk: Buffer) => {
        try {
          controller.enqueue(new Uint8Array(chunk));
        } catch {
          killAll();
          return;
        }

        if (controller.desiredSize !== null && controller.desiredSize <= 0) {
          output.pause();
        }
      });

      output.on("end", closeOnce);
      ffmpeg.on("close", closeOnce);
      ffmpeg.on("error", () => {
        try {
          controller.error(new Error(stderr || "ffmpeg failed to start."));
        } catch {
          // already errored
        }
        killAll();
      });
      streamlink.on("error", () => {
        try {
          controller.error(new Error(stderr || "Streamlink failed to start."));
        } catch {
          // already errored
        }
        killAll();
      });
    },
    pull() {
      output.resume();
    },
    cancel() {
      killAll();
    }
  });

  request.signal.addEventListener("abort", killAll);

  return new Response(stream, {
    headers: {
      "Content-Type": "video/mp2t",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive"
    }
  });
}

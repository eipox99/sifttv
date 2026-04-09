import { NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { getRefreshJob } from "@/lib/local-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await context.params;

  try {
    const job = getRefreshJob(jobId);

    if (!job) {
      return jsonError("Refresh job not found.", 404);
    }

    return NextResponse.json({
      job: {
        id: job.id,
        status: job.status,
        pageCount: job.pageCount,
        streamCount: job.streamCount,
        duplicateCount: job.duplicateCount,
        error: job.error,
        snapshotId: job.snapshotId,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt
      }
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load refresh job.", 500);
  }
}

import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";

import { env, hasRedisUrl } from "@/lib/env";

export const refreshQueueName = "category-refresh";

let queue: Queue | null = null;
let worker: Worker | null = null;
let redisConnection: IORedis | null = null;

function getRedisConnection() {
  if (!hasRedisUrl()) {
    throw new Error("REDIS_URL is not configured.");
  }

  if (!redisConnection) {
    redisConnection = new IORedis(env.REDIS_URL as string, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    });
  }

  return redisConnection;
}

export function getRefreshQueue() {
  if (!queue) {
    queue = new Queue(refreshQueueName, {
      connection: getRedisConnection()
    });
  }

  return queue;
}

export function registerRefreshWorker(processor: (jobId: string) => Promise<void>) {
  if (!hasRedisUrl()) {
    throw new Error("REDIS_URL is not configured.");
  }

  if (!worker) {
    worker = new Worker(
      refreshQueueName,
      async (job) => {
        await processor(String(job.data.jobId));
      },
      {
        connection: getRedisConnection()
      }
    );
  }

  return worker;
}


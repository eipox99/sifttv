import { registerRefreshWorker } from "../src/lib/jobs";
import { processRefreshJob } from "../src/lib/refresh";

async function main() {
  const worker = registerRefreshWorker(processRefreshJob);
  await worker.waitUntilReady();
  console.log("Refresh worker is ready.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

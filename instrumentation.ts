export async function register() {
  // Only run cron jobs in the Node.js runtime (not Edge), and never during build
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV !== "test") {
    const { startCronJobs } = await import("./lib/cron");
    startCronJobs();
  }
}

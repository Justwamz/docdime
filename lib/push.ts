// eslint-disable-next-line @typescript-eslint/no-require-imports
const webpush = require("web-push") as typeof import("web-push");
import { prisma } from "./prisma";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

/** Lazy-initialize VAPID — called inside functions, never at module load time */
function initVapid() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:admin@docdime.com",
    publicKey,
    privateKey
  );
  return true;
}

async function sendPushToSubscription(
  id: string,
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: PushPayload
) {
  if (!initVapid()) return; // silently skip if not configured
  try {
    await webpush.sendNotification(
      { endpoint, keys: { p256dh, auth } },
      JSON.stringify(payload)
    );
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      await prisma.pushSubscription.delete({ where: { id } });
    } else {
      console.error("[Push] sendNotification error:", err);
    }
  }
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  await Promise.allSettled(
    subs.map((sub) =>
      sendPushToSubscription(sub.id, sub.endpoint, sub.p256dh, sub.auth, payload)
    )
  );
}

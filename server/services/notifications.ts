import type { Lead } from "../../src/lib/types";

export type TeamNotification = {
  event: string;
  lead: Pick<Lead, "businessName" | "phone" | "website" | "city" | "score" | "status">;
  callSummary?: string;
  nextAction?: string;
};

export async function notifyTeam(notification: TeamNotification) {
  const webhookUrl = process.env.TEAM_NOTIFICATION_WEBHOOK_URL;
  const payload = {
    ...notification,
    recipients: [process.env.ROB_EMAIL, process.env.IREINE_EMAIL].filter(Boolean),
    createdAt: new Date().toISOString()
  };

  if (!webhookUrl) {
    console.info("[notification:mock]", JSON.stringify(payload));
    return { ok: true, mocked: true };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return { ok: response.ok, status: response.status };
  } catch (error) {
    console.error("[notification:error]", error);
    return { ok: false, error: String(error) };
  }
}

/**
 * Monday Morning Disengagement Alert
 * ────────────────────────────────────
 * Fires at 08:00 AEST every Monday.
 * 1. Uses Puppeteer to headlessly screenshot the live disengagement card
 *    (exact same output as the manual "Export PNG" button in the UI).
 * 2. Uploads the PNG to Slack and posts it to #seal-team-six channel.
 * 3. Falls back to a text-based DM to the manager if screenshot fails.
 */
import { screenshotDisengagementCard } from "./screenshotDisengagement";
import { ENV } from "./env";
import { sendSlackDM } from "./slackReminders";

const MANAGER_SLACK_ID   = ENV.managerSlackId;
const SLACK_BOT_TOKEN    = ENV.slackBotToken;
const APP_URL            = ENV.appUrl || "https://databitecoach.com";

// #seal-team-six channel ID
const SEAL_TEAM_SIX_CHANNEL = "C09AD6EDCDU";

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getMondayLocal(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}

function toDateAU(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const m  = String(d.getMonth() + 1).padStart(2, "0");
  const y  = d.getFullYear();
  return `${dd}/${m}/${y}`;
}

function toDateStr(d: Date): string {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// ─── Slack file upload (v2 API) ───────────────────────────────────────────────

async function uploadPngToSlackChannel(
  pngBuffer: Buffer,
  filename: string,
  channelId: string,
  initialComment: string,
): Promise<boolean> {
  if (!SLACK_BOT_TOKEN) {
    console.warn("[Slack Disengagement] SLACK_BOT_TOKEN not set — cannot upload PNG");
    return false;
  }

  try {
    // Step 1: Get upload URL
    const urlRes = await fetch("https://slack.com/api/files.getUploadURLExternal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify({
        filename,
        length: pngBuffer.length,
      }),
    });
    const urlData = await urlRes.json() as {
      ok: boolean; upload_url?: string; file_id?: string; error?: string;
    };
    if (!urlData.ok || !urlData.upload_url || !urlData.file_id) {
      console.error("[Slack Disengagement] getUploadURLExternal failed:", urlData.error);
      return false;
    }

    // Step 2: Upload the file bytes
    const uploadRes = await fetch(urlData.upload_url, {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: new Uint8Array(pngBuffer),
    });
    if (!uploadRes.ok) {
      console.error("[Slack Disengagement] File upload failed:", uploadRes.status);
      return false;
    }

    // Step 3: Complete the upload and share to channel
    const completeRes = await fetch("https://slack.com/api/files.completeUploadExternal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify({
        files: [{ id: urlData.file_id, title: filename }],
        channel_id: channelId,
        initial_comment: initialComment,
      }),
    });
    const completeData = await completeRes.json() as { ok: boolean; error?: string };
    if (!completeData.ok) {
      console.error("[Slack Disengagement] completeUploadExternal failed:", completeData.error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[Slack Disengagement] PNG upload error:", err);
    return false;
  }
}

// ─── Main alert function ──────────────────────────────────────────────────────

export async function sendDisengagementAlert(): Promise<void> {
  const now = new Date();
  const currentMonday = getMondayLocal(now);
  const weekLabelAU  = toDateAU(currentMonday);
  const weekLabelISO = toDateStr(currentMonday);

  console.log(`[Slack Disengagement] Starting Monday alert for week of ${weekLabelAU}`);

  // ── Attempt Puppeteer screenshot ────────────────────────────────────────────
  let pngUploaded = false;
  try {
    console.log("[Slack Disengagement] Launching Puppeteer screenshot...");
    const pngBuffer = await screenshotDisengagementCard();
    if (!pngBuffer) {
      console.log("[Slack Disengagement] Screenshot not available — skipping PNG upload");
    } else {
      const filename = `disengagement-${weekLabelISO}.png`;
      const comment = `Hey Team, hope everyone had a good weekend!\n\nHere is our focus list for this week based on last week's check ins. Let's get quick looms out to anyone in red who we are yet to hear from!\n\n👉 <${APP_URL}/client-checkins?tab=disengagement|View full disengagement list>`;
      pngUploaded = await uploadPngToSlackChannel(pngBuffer, filename, SEAL_TEAM_SIX_CHANNEL, comment);
    }
    if (pngUploaded) {
      console.log(`[Slack Disengagement] PNG posted to #seal-team-six for week of ${weekLabelAU}`);
    }
  } catch (err) {
    console.error("[Slack Disengagement] Puppeteer screenshot failed:", err);
  }

  // ── Fallback: text summary DM to manager ───────────────────────────────────
  if (!pngUploaded) {
    if (!MANAGER_SLACK_ID) {
      console.warn("[Slack Disengagement] MANAGER_SLACK_ID not set — skipping fallback DM");
      return;
    }
    const msg =
      `🚨 *Disengagement Alert — Week of ${weekLabelAU}*\n\n` +
      `_(PNG screenshot failed — check server logs)_\n\n` +
      `👉 <${APP_URL}/client-checkins?tab=disengagement|View Disengagement Tracking>`;
    await sendSlackDM(MANAGER_SLACK_ID, msg);
    console.log("[Slack Disengagement] Fallback text DM sent to manager");
  }
}

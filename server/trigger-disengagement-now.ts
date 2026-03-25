import { sendDisengagementAlert } from "./slackDisengagementAlert";

async function main() {
  console.log("[Trigger] Sending disengagement alert to #seal-team-six...");
  await sendDisengagementAlert();
  console.log("[Trigger] Done.");
  process.exit(0);
}

main().catch(err => {
  console.error("[Trigger] Failed:", err);
  process.exit(1);
});

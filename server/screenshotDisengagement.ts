/**
 * screenshotDisengagement.ts
 *
 * Automated Puppeteer screenshot of the disengagement card is tabled for now
 * (Puppeteer requires system Chromium which is not available in the production
 * deployment environment).
 *
 * The Monday Slack job falls back to a text-only summary when this returns null.
 */

export async function screenshotDisengagementCard(): Promise<Buffer | null> {
  return null;
}

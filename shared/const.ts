export const UNAUTHED_ERR_MSG = "UNAUTHORIZED";

export const CLIENT_CHECKINS_EPOCH = "2026-03-02";

export const ADMIN_EMAILS = [
  "rich@databite.com.au",
  "suzie@databite.com.au",
];

/** Coach names hidden from non-admin users */
export const HIDDEN_COACH_NAMES = ["Rich"];

export const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
export type DayKey = (typeof DAYS)[number];

export const TEAM_SLACK_CHANNEL = "C09AD6EDCDU"; // #seal-team-six
export const ONBOARDING_SLACK_CHANNEL = "C0ATQJGNRAS"; // #onboarding-alerts

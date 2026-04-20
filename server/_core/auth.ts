import { Request, Response, Express } from "express";
import { SignJWT, jwtVerify } from "jose";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { users, coaches } from "../../drizzle/schema";
import { ENV } from "../env";
import { ADMIN_EMAILS } from "../../shared/const";

/** Sales team members */
const SALES_EMAILS: Record<string, string> = {
  "yaman@databite.com.au": "Yaman",
};

/** Check if an email is allowed to log in — admins, sales, or any active coach with an email in the DB */
async function isEmailAllowed(email: string): Promise<boolean> {
  if (ADMIN_EMAILS.includes(email)) return true;
  if (SALES_EMAILS[email]) return true;
  const db = await getDb();
  if (!db) return false;
  const [coach] = await db.select().from(coaches).where(and(eq(coaches.email, email), eq(coaches.isActive, 1))).limit(1);
  return !!coach;
}

/** Look up a coach by email from the DB */
async function getCoachByEmail(email: string): Promise<{ id: number; name: string; email: string | null; userId: number | null } | null> {
  const db = await getDb();
  if (!db) return null;
  const [coach] = await db.select().from(coaches).where(and(eq(coaches.email, email), eq(coaches.isActive, 1))).limit(1);
  return coach || null;
}

const JWT_SECRET = new TextEncoder().encode(ENV.cookieSecret || "dev-secret-change-me");
const COOKIE_NAME = "session";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

/**
 * Create a signed JWT for a user.
 */
async function createToken(userId: number): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(JWT_SECRET);
}

/**
 * Verify a JWT and return the payload.
 */
async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { userId: number };
  } catch {
    return null;
  }
}

/**
 * Get user from request cookies.
 */
export async function authenticateRequest(req: Request) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  const db = await getDb();
  if (!db) return null;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, payload.userId))
    .limit(1);

  return user || null;
}

/**
 * Register auth routes on the Express app.
 */
export async function registerAuthRoutes(app: Express) {
  // Cookie parser middleware
  const cookieParser = await import("cookie");

  // Parse cookies on every request
  app.use((req, _res, next) => {
    const cookieHeader = req.headers.cookie || "";
    req.cookies = {};
    if (cookieHeader) {
      const parsed = cookieParser.parse(cookieHeader);
      req.cookies = parsed;
    }
    next();
  });

  // Get current user
  app.get("/api/auth/me", async (req, res) => {
    try {
      const user = await authenticateRequest(req);
      if (!user) {
        return res.status(401).json(null);
      }
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImageUrl: user.profileImageUrl,
      });
    } catch {
      res.status(401).json(null);
    }
  });

  // Login with email (simple email-based login for now)
  app.post("/api/auth/login", async (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database unavailable" });
    }

    // Find or create user
    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      // Create new user
      const emailLc = email.toLowerCase();
      const isAdmin = ADMIN_EMAILS.includes(emailLc);
      const isSales = SALES_EMAILS[emailLc] != null;
      const ADMIN_NAMES: Record<string, string> = { "rich@databite.com.au": "Rich", "suzie@databite.com.au": "Suzie" };
      const coachRecord = await getCoachByEmail(emailLc);
      const knownName = isAdmin ? (ADMIN_NAMES[emailLc] || null) : coachRecord?.name || SALES_EMAILS[emailLc] || null;
      const [result] = await db.insert(users).values({
        email,
        name: knownName || email.split("@")[0],
        role: isAdmin ? "admin" : isSales ? "sales" : "coach",
      });
      [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, result.insertId))
        .limit(1);
    }

    // Auto-promote admin emails
    if (ADMIN_EMAILS.includes(email.toLowerCase()) && user.role !== "admin") {
      await db.update(users).set({ role: "admin" }).where(eq(users.id, user.id));
      user = { ...user, role: "admin" };
    }

    // Auto-link coach profile for emails that match a coach in the DB
    const emailLower = email.toLowerCase();
    const coachForEmail = await getCoachByEmail(emailLower);
    if (coachForEmail) {
      if (user.role !== "coach" && !ADMIN_EMAILS.includes(emailLower)) {
        await db.update(users).set({ role: "coach" }).where(eq(users.id, user.id));
        user = { ...user, role: "coach" };
      }

      // Link coach to user if not already linked
      const [existingCoach] = await db
        .select()
        .from(coaches)
        .where(eq(coaches.email, emailLower))
        .limit(1);

      if (existingCoach && !existingCoach.userId) {
        await db
          .update(coaches)
          .set({ userId: user.id })
          .where(eq(coaches.id, existingCoach.id));
      }
    }

    const token = await createToken(user.id);

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: ENV.isProduction,
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE * 1000,
      path: "/",
    });

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  });

  // Dev login — auto-login as admin (dev only)
  if (!ENV.isProduction) {
    app.get("/api/auth/dev-login", async (req, res) => {
      const email = (req.query.email as string) || ADMIN_EMAILS[0];
      const db = await getDb();
      if (!db) return res.status(500).json({ error: "Database unavailable" });

      let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user) {
        const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase());
        const [result] = await db.insert(users).values({
          email,
          name: isAdmin ? "Rich" : email.split("@")[0],
          role: isAdmin ? "admin" : "coach",
        });
        [user] = await db.select().from(users).where(eq(users.id, result.insertId)).limit(1);
      }

      const token = await createToken(user.id);
      res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: COOKIE_MAX_AGE * 1000,
        path: "/",
      });
      res.redirect("/client-checkins");
    });
  }

  // Google OAuth — redirect to Google consent screen
  app.get("/api/auth/google", (_req, res) => {
    const redirectUri = `${ENV.appUrl}/api/auth/google/callback`;
    const params = new URLSearchParams({
      client_id: ENV.googleClientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "select_account",
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  });

  // Google OAuth — callback
  app.get("/api/auth/google/callback", async (req, res) => {
    const { code, error: oauthError } = req.query;

    if (oauthError || !code || typeof code !== "string") {
      return res.redirect("/login?error=google_denied");
    }

    try {
      const redirectUri = `${ENV.appUrl}/api/auth/google/callback`;

      // Exchange code for tokens
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: ENV.googleClientId,
          client_secret: ENV.googleClientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }).toString(),
      });

      if (!tokenRes.ok) {
        const errBody = await tokenRes.text();
        console.error("[Google OAuth] Token exchange failed:", tokenRes.status, errBody);
        console.error("[Google OAuth] redirect_uri used:", redirectUri);
        console.error("[Google OAuth] client_id used:", ENV.googleClientId);
        return res.redirect("/login?error=google_token_failed");
      }

      const tokenData = await tokenRes.json() as { access_token?: string };
      if (!tokenData.access_token) {
        return res.redirect("/login?error=google_token_failed");
      }

      // Get user info
      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      if (!userInfoRes.ok) {
        return res.redirect("/login?error=google_userinfo_failed");
      }

      const userInfo = await userInfoRes.json() as { email?: string; name?: string };
      const email = userInfo.email?.toLowerCase();

      if (!email) {
        return res.redirect("/login?error=no_email");
      }

      // Check if email is allowed (admins, sales, or active coach in DB)
      if (!(await isEmailAllowed(email))) {
        return res.redirect("/login?error=not_approved");
      }

      const db = await getDb();
      if (!db) {
        return res.redirect("/login?error=db_unavailable");
      }

      // Find or create user — same logic as email login
      let [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        const isAdmin = ADMIN_EMAILS.includes(email);
        const isSales = SALES_EMAILS[email] != null;
        const ADMIN_NAMES: Record<string, string> = { "rich@databite.com.au": "Rich", "suzie@databite.com.au": "Suzie" };
        const coachRecord = await getCoachByEmail(email);
        const knownName = isAdmin ? (ADMIN_NAMES[email] || null) : coachRecord?.name || SALES_EMAILS[email] || null;
        const [result] = await db.insert(users).values({
          email,
          name: knownName || userInfo.name || email.split("@")[0],
          role: isAdmin ? "admin" : isSales ? "sales" : "coach",
        });
        [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, result.insertId))
          .limit(1);
      }

      // Auto-promote admin emails
      if (ADMIN_EMAILS.includes(email) && user.role !== "admin") {
        await db.update(users).set({ role: "admin" }).where(eq(users.id, user.id));
        user = { ...user, role: "admin" };
      }

      // Auto-link coach profile from DB
      const coachForEmail = await getCoachByEmail(email);
      if (coachForEmail) {
        if (user.role !== "coach" && !ADMIN_EMAILS.includes(email)) {
          await db.update(users).set({ role: "coach" }).where(eq(users.id, user.id));
          user = { ...user, role: "coach" };
        }
        if (!coachForEmail.userId) {
          await db.update(coaches).set({ userId: user.id }).where(eq(coaches.id, coachForEmail.id));
        }
      }

      const token = await createToken(user.id);

      res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: ENV.isProduction,
        sameSite: "lax",
        maxAge: COOKIE_MAX_AGE * 1000,
        path: "/",
      });

      res.redirect("/");
    } catch (err) {
      console.error("[Google OAuth] Callback error:", err);
      res.redirect("/login?error=google_failed");
    }
  });

  // Logout
  app.post("/api/auth/logout", (_req, res) => {
    res.cookie(COOKIE_NAME, "", {
      httpOnly: true,
      secure: ENV.isProduction,
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });
    res.json({ ok: true });
  });
}

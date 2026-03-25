import { Request, Response, Express } from "express";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { ENV } from "../env";
import { ADMIN_EMAILS } from "../../shared/const";

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
      const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase());
      const [result] = await db.insert(users).values({
        email,
        name: email.split("@")[0],
        role: isAdmin ? "admin" : "coach",
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

    const token = await createToken(user.id);

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: ENV.isProduction,
      sameSite: ENV.isProduction ? "none" : "lax",
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

  // Logout
  app.post("/api/auth/logout", (_req, res) => {
    res.cookie(COOKIE_NAME, "", {
      httpOnly: true,
      secure: ENV.isProduction,
      sameSite: ENV.isProduction ? "none" : "lax",
      maxAge: 0,
      path: "/",
    });
    res.json({ ok: true });
  });
}

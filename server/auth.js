import "dotenv/config";
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "./src/prisma/db.ts";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is missing from server/.env");
}

const users = db.orm.public.User;
const router = Router();

const COOKIE_NAME = "token";
const COOKIE_BASE = {
  httpOnly: true, // scripts in the page can't read it
  sameSite: "lax", // not sent on most cross-site requests
  secure: process.env.NODE_ENV === "production", // HTTPS only when deployed
};
const COOKIE_OPTIONS = { ...COOKIE_BASE, maxAge: 7 * 24 * 60 * 60 * 1000 }; // 7 days

// Used so a login for an unknown email takes as long as one for a real email
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

function setSession(res, user) {
  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
}

const publicUser = (user) => ({ id: user.id, email: user.email });

// The door reader: runs before protected routes
export async function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "Not logged in" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session" });
  }
}

router.post("/signup", async (req, res) => {
  const email = String(req.body.email ?? "").trim().toLowerCase();
  const password = String(req.body.password ?? "");

  if (!email.includes("@") || email.length > 254) {
    return res.status(400).json({ error: "Enter a valid email" });
  }
  if (password.length < 8 || password.length > 72) {
    return res.status(400).json({ error: "Password must be 8 to 72 characters" });
  }

  try {
    const existing = await users.where({ email }).first();
    if (existing) {
      return res.status(409).json({ error: "That email is already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await users.create({ email, passwordHash });

    setSession(res, user);
    res.status(201).json(publicUser(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not sign up" });
  }
});

router.post("/login", async (req, res) => {
  const email = String(req.body.email ?? "").trim().toLowerCase();
  const password = String(req.body.password ?? "");

  try {
    const user = await users.where({ email }).first();
    const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);

    if (!user || !ok) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    setSession(res, user);
    res.json(publicUser(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not log in" });
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, COOKIE_BASE);
  res.status(204).end();
});

// "Who am I?" The frontend calls this on page load
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await users.where({ id: req.userId }).first();
    if (!user) return res.status(401).json({ error: "Account no longer exists" });
    res.json(publicUser(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load account" });
  }
});

export default router;
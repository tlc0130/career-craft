import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { db, users, registerSchema, loginSchema } from "@workspace/db";
import { eq, or } from "drizzle-orm";

const router = Router();

const LIFETIME_FREE_EMAIL = "tlc01301@gmail.com";

router.post("/auth/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }

  const { email, password } = parsed.data;

  try {
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const isLifetimeFree = email.toLowerCase() === LIFETIME_FREE_EMAIL.toLowerCase();

    const [user] = await db.insert(users).values({
      email,
      passwordHash,
      plan: isLifetimeFree ? "lifetime" : "starter",
      lifetimeAccess: isLifetimeFree,
    }).returning();

    req.session.userId = user.id;
    res.status(201).json({
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      phone: user.phone ?? null,
      plan: user.plan,
      lifetimeAccess: user.lifetimeAccess,
    });
  } catch (err) {
    req.log.error({ err }, "Register error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { email, password } = parsed.data;

  try {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    if (!user.passwordHash) {
      // Google-only account — no password set
      res.status(401).json({ error: "This account uses Google sign-in. Please continue with Google." });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const isLifetimeFree = email.toLowerCase() === LIFETIME_FREE_EMAIL.toLowerCase();
    if (isLifetimeFree && (!user.lifetimeAccess || user.plan !== "lifetime")) {
      await db.update(users)
        .set({ lifetimeAccess: true, plan: "lifetime" })
        .where(eq(users.id, user.id));
      user.lifetimeAccess = true;
      user.plan = "lifetime";
    }

    req.session.userId = user.id;
    res.json({
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      phone: user.phone ?? null,
      plan: user.plan,
      lifetimeAccess: user.lifetimeAccess,
    });
  } catch (err) {
    req.log.error({ err }, "Login error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get("/auth/me", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.session.userId)).limit(1);
    if (!user) {
      req.session.destroy(() => {});
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      phone: user.phone ?? null,
      plan: user.plan,
      lifetimeAccess: user.lifetimeAccess,
    });
  } catch (err) {
    req.log.error({ err }, "Auth me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/auth/me", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const body = req.body as { name?: unknown; phone?: unknown };
  const name = typeof body.name === "string" ? body.name : undefined;
  const phone = typeof body.phone === "string" ? body.phone : undefined;

  if (name !== undefined && name.length > 100) {
    res.status(400).json({ error: "name must be 100 characters or fewer" });
    return;
  }
  if (phone !== undefined && phone.length > 30) {
    res.status(400).json({ error: "phone must be 30 characters or fewer" });
    return;
  }

  if (name === undefined && phone === undefined) {
    res.status(400).json({ error: "At least one of name or phone must be provided" });
    return;
  }

  try {
    const [updated] = await db
      .update(users)
      .set({
        ...(name !== undefined ? { name } : {}),
        ...(phone !== undefined ? { phone } : {}),
      })
      .where(eq(users.id, req.session.userId))
      .returning();

    if (!updated) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    res.json({
      id: updated.id,
      email: updated.email,
      name: updated.name ?? null,
      phone: updated.phone ?? null,
      plan: updated.plan,
      lifetimeAccess: updated.lifetimeAccess,
    });
  } catch (err) {
    req.log.error({ err }, "Auth me update error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/auth/google", (req, res) => {
  const clientId = process.env["GOOGLE_CLIENT_ID"];
  const appUrl = process.env["APP_URL"] ?? "";

  if (!clientId) {
    res.status(501).json({ error: "Google login not configured" });
    return;
  }

  const state = crypto.randomBytes(16).toString("hex");
  req.session.oauthState = state;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "offline",
    prompt: "select_account",
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

router.get("/auth/google/callback", async (req, res) => {
  const appUrl = process.env["APP_URL"] ?? "";

  try {
    const { state, error: oauthError, code } = req.query as Record<string, string>;

    if (state !== req.session.oauthState) {
      res.redirect(`${appUrl}/login?error=oauth_state`);
      return;
    }
    delete req.session.oauthState;

    if (oauthError) {
      res.redirect(`${appUrl}/login?error=oauth_denied`);
      return;
    }

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env["GOOGLE_CLIENT_ID"] ?? "",
        client_secret: process.env["GOOGLE_CLIENT_SECRET"] ?? "",
        redirect_uri: `${appUrl}/api/auth/google/callback`,
        code,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      req.log.error({ status: tokenRes.status, body }, "Google token exchange failed");
      res.redirect(`${appUrl}/login?error=oauth_failed`);
      return;
    }

    const tokenData = await tokenRes.json() as { access_token: string };

    // Fetch user profile
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!profileRes.ok) {
      req.log.error({ status: profileRes.status }, "Google userinfo fetch failed");
      res.redirect(`${appUrl}/login?error=oauth_failed`);
      return;
    }

    const profile = await profileRes.json() as {
      sub: string;
      email: string;
      name?: string;
      email_verified?: boolean;
    };

    // Look up user by googleId or email
    const existing = await db
      .select()
      .from(users)
      .where(or(eq(users.googleId, profile.sub), eq(users.email, profile.email)))
      .limit(1);

    let user = existing[0];

    if (user) {
      if (!user.googleId) {
        // Existing email account — link Google ID
        const [updated] = await db
          .update(users)
          .set({ googleId: profile.sub })
          .where(eq(users.id, user.id))
          .returning();
        user = updated;
      }
      // else: already linked, just log in
    } else {
      // New user via Google
      const [created] = await db
        .insert(users)
        .values({
          email: profile.email,
          name: profile.name ?? null,
          googleId: profile.sub,
          passwordHash: null,
          plan: "starter",
        })
        .returning();
      user = created;
    }

    req.session.userId = user.id;
    res.redirect(`${appUrl}/`);
  } catch (err) {
    req.log.error({ err }, "Google OAuth callback error");
    res.redirect(`${process.env["APP_URL"] ?? ""}/login?error=oauth_failed`);
  }
});

export default router;

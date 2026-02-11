import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import express, { Express } from "express"; // Added express import
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual, createHash } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User } from "@shared/schema";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function setupAuth(app: Express) {
  // 1. FORCE BODY PARSING (Fixes empty req.body issues)
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const isPasswordResetEnabled = process.env.PASSWORD_RESET_ENABLED === "true";

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "trading_journal_secret",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
  };

  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // LOGIN STRATEGY
  passport.use(
    new LocalStrategy({ usernameField: 'username' }, async (emailOrUsername, password, done) => {
      const user = await storage.getUserByEmail(emailOrUsername);
      if (!user || !(await comparePasswords(password, user.password))) {
        return done(null, false);
      } 
      if (user.isApproved === false) {
        return done(null, false, { message: "Account pending admin approval." });
      }
      return done(null, user);
      
    }),
  );

  passport.serializeUser((user, done) => done(null, (user as User).id));
  passport.deserializeUser(async (id: number, done) => {
    const user = await storage.getUser(id);
    done(null, user);
  });

  // REGISTER ROUTE (With Debugging)
  app.post("/api/register", async (req, res, next) => {
    try {
      // DEBUG: Print exactly what the frontend sent
      console.log("--- REGISTER DEBUG ---");
      console.log("Headers:", req.headers['content-type']);
      console.log("Body:", req.body);

      // 2. Robust Field Extraction
      // Check for 'email', 'username', or 'Email' (case sensitive sometimes)
      const email = req.body.email || req.body.username || req.body.Email;
      const password = req.body.password || req.body.Password;

      if (!email || !password) {
        console.error("Missing fields. Email:", email, "Password:", password ? "***" : "missing");
        return res.status(400).json({ message: "Email and Password are required. Check server console." });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      const hashedPassword = await hashPassword(password);
      
      const user = await storage.createUser({
        email: email, 
        password: hashedPassword,
      });

      // req.login(user, (err) => {
      //   if (err) return next(err);
      //   res.status(201).json(user);
      // });
      res.status(201).json({ 
        message: "Registration successful! Your account is pending admin approval." 
      });
    } catch (error) {
      console.error("Registration error:", error);
      const errorMessage = error instanceof Error ? error.message : "Registration failed";
      res.status(500).json({ message: errorMessage });
    }
  });

  app.post("/api/login", (req, res, next) => {
    // Map email to username for passport
    if (req.body.email && !req.body.username) {
        req.body.username = req.body.email;
    }
    next();
  }, passport.authenticate("local"), (req, res) => {
    res.status(200).json(req.user);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.post("/api/password/change", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const currentPassword = req.body.currentPassword;
    const newPassword = req.body.newPassword;

    if (!currentPassword || !newPassword) {
      return res.status(400).send("Current password and new password are required.");
    }
    if (newPassword.length < 6) {
      return res.status(400).send("New password must be at least 6 characters.");
    }

    const user = await storage.getUser((req.user as User).id);
    if (!user) return res.sendStatus(401);

    const isMatch = await comparePasswords(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).send("Current password is incorrect.");
    }

    const hashedPassword = await hashPassword(newPassword);
    await storage.updateUserPassword(user.id, hashedPassword);
    res.status(200).json({ message: "Password updated successfully." });
  });

  app.post("/api/password/forgot", async (req, res) => {
    if (!isPasswordResetEnabled) {
      return res.status(403).json({ message: "Password reset is disabled." });
    }

    const email = req.body.email;
    if (!email) {
      return res.status(400).send("Email is required.");
    }

    const user = await storage.getUserByEmail(email);
    if (user) {
      const token = randomBytes(32).toString("hex");
      const tokenHash = hashResetToken(token);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await storage.setResetToken(user.id, tokenHash, expiresAt);

      const payload: { message: string; resetToken?: string } = {
        message: "If an account exists, a reset token has been issued.",
      };
      if (process.env.NODE_ENV !== "production") {
        payload.resetToken = token;
      }
      return res.status(200).json(payload);
    }

    return res.status(200).json({
      message: "If an account exists, a reset token has been issued.",
    });
  });

  app.post("/api/password/reset", async (req, res) => {
    if (!isPasswordResetEnabled) {
      return res.status(403).json({ message: "Password reset is disabled." });
    }

    const email = req.body.email;
    const token = req.body.token;
    const newPassword = req.body.newPassword;

    if (!email || !token || !newPassword) {
      return res.status(400).send("Email, token, and new password are required.");
    }
    if (newPassword.length < 6) {
      return res.status(400).send("New password must be at least 6 characters.");
    }

    const tokenHash = hashResetToken(token);
    const user = await storage.getUserByEmailAndResetToken(
      email,
      tokenHash,
      new Date(),
    );
    if (!user) {
      return res.status(400).send("Invalid or expired reset token.");
    }

    const hashedPassword = await hashPassword(newPassword);
    await storage.updateUserPassword(user.id, hashedPassword);
    res.status(200).json({ message: "Password reset successfully." });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
}

import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage, sessionStore } from "./storage";
import bcrypt from "bcryptjs";

const scryptAsync = promisify(scrypt);

// 1. EXPORT hashPassword (This fixes your current error)
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// 2. EXPORT comparePassword
async function comparePassword(supplied: string, stored: string) {
  if (!stored) return false;

  if (stored.includes('.')) {
    try {
      const [hashed, salt] = stored.split(".");
      const hashedPasswordBuf = Buffer.from(hashed, "hex");
      const suppliedPasswordBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
      return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
    } catch (e) {
      return false;
    }
  }

  if (/^\$2[aby]\$/.test(stored)) {
    try {
      return await bcrypt.compare(supplied, stored);
    } catch (e) {
      return false;
    }
  }

  return supplied === stored;
}

// 3. EXPORT normalizeUser
export function normalizeUser(user: any) {
  if (!user) return user;
  let role = user.role;
  if (role === 'client') role = 'user';
  return {
    ...user,
    role,
    balance: typeof user.balance === 'string' ? parseFloat(user.balance) : user.balance,
    totalOrdersToday: typeof user.totalOrdersToday === 'string' ? parseInt(user.totalOrdersToday) : user.totalOrdersToday,
    totalGBSentToday: typeof user.totalGBSentToday === 'string' ? parseFloat(user.totalGBSentToday) : user.totalGBSentToday,
    totalSpentToday: typeof user.totalSpentToday === 'string' ? parseFloat(user.totalSpentToday) : user.totalSpentToday,
    totalGBPurchased: typeof user.totalGBPurchased === 'string' ? parseFloat(user.totalGBPurchased) : (user.totalGBPurchased ?? 0),
  };
}

export function setupAuth(app: Express) {
  // 1. Tell Express to trust the Render proxy (Required for secure cookies)
  app.set("trust proxy", 1);

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "r8q,+&1LM3)CD*zAGpx1xm{NeQhc;#",
    resave: false,
    saveUninitialized: false,
    store: sessionStore || undefined,
    name: "allendatahub.sid",
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      // 2. These two settings allow Vercel and Render to talk to each other
      secure: true, // Must be true for SameSite: 'none'
      sameSite: "none", // Allows cross-site cookie usage
    },
  };

  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy({ usernameField: "identifier" }, async (identifier, password, done) => {
      try {
        const trimmedId = typeof identifier === 'string' ? identifier.trim() : '';
        if (!trimmedId) return done(null, false);
        const user = await storage.getUserByUsername(trimmedId);
        if (!user) return done(null, false);

        const matched = await comparePassword(password, user.password);
        if (!matched) return done(null, false);

        // Auto-migrate legacy passwords
        if (typeof user.password === 'string' && !user.password.includes('.')) {
          const newHash = await hashPassword(password);
          const uid = (user as any).id || (user as any)._id?.toString();
          if (uid) await storage.updatePassword(uid, newHash);
          (user as any).password = newHash;
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }),
  );

  passport.serializeUser((user: any, done) => {
    const uid = user._id ? user._id.toString() : user.id;
    done(null, uid);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // Auth Endpoints
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: "Invalid username or password" });
      req.logIn(user, (err) => {
        if (err) return next(err);
        return res.json(normalizeUser(user));
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = normalizeUser(req.user);
    res.json(Array.isArray(user) ? user : [user]);
  });
}
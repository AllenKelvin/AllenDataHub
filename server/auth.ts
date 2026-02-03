import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage, sessionStore } from "./storage";
import bcrypt from "bcryptjs";

const scryptAsync = promisify(scrypt);

// Normalize numeric fields from database (which may be stored as strings)
export function normalizeUser(user: any) {
  if (!user) return user;
  // Map imported 'client' role to 'user'
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

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePassword(supplied: string, stored: string) {
  if (!stored) return false;

  // Current hashed format: <hexhash>.<salt>
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

  // If stored looks like a bcrypt hash ($2a$, $2b$, $2y$), use bcrypt compare (imported data)
  if (/^\$2[aby]\$/.test(stored)) {
    try {
      return await bcrypt.compare(supplied, stored);
    } catch (e) {
      return false;
    }
  }

  // Legacy fallback: if stored passwords were imported in plaintext,
  // accept exact match and allow migration elsewhere.
  return supplied === stored;
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "r8q,+&1LM3)CD*zAGpx1xm{NeQhc;#",
    resave: false,
    saveUninitialized: false,
    store: sessionStore || undefined,
    name: "allendatahub.sid",
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
      secure: app.get("env") === "production",
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
      const trimmedId = typeof identifier === 'string' ? identifier.trim() : '';
      if (!trimmedId) return done(null, false);
      const user = await storage.getUserByUsername(trimmedId);
      console.log('[Auth] Looking up user:', trimmedId, '| Found:', !!user);
      if (!user) return done(null, false);

      console.log('[Auth] User found. Stored password hash:', user.password?.substring(0, 20) + '...');
      const matched = await comparePassword(password, user.password);
      console.log('[Auth] Password match result:', matched);
      if (!matched) return done(null, false);

      // If the stored password was legacy plaintext (no dot separator),
      // migrate it to the new scrypt format for future logins.
      try {
        if (typeof user.password === 'string' && !user.password.includes('.')) {
          const newHash = await hashPassword(password);
          const uid = (user as any).id || (user as any)._id?.toString();
          if (uid) await storage.updatePassword(uid, newHash);
          // update local user object to use new hash
          (user as any).password = newHash;
        }
      } catch (e) {
        // migration failure shouldn't block login
        console.warn('Password migration failed for user', (user as any).id, e);
      }

      return done(null, user);
    }),
  );

  passport.serializeUser((user, done) => {
    const uid = (user as any)._id ? (user as any)._id.toString() : (user as any).id;
    done(null, uid);
  });

  passport.deserializeUser(async (id, done) => {
    const user = await storage.getUser(id as string);
    done(null, user);
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      req.logIn(user, (err) => {
        if (err) {
          return next(err);
        }
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

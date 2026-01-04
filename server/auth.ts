import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { storage } from "./storage";

const SALT_ROUNDS = 12;

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
    },
  });
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user: any, done) => {
    done(null, { id: user.id, email: user.email });
  });

  passport.deserializeUser(async (data: any, done) => {
    try {
      // Handle new format: { id, email }
      if (data && data.id) {
        const user = await storage.getUser(data.id);
        if (user) {
          return done(null, user);
        }
      }
      // Handle old Replit Auth format: { claims: { sub: ... } }
      if (data && data.claims && data.claims.sub) {
        const user = await storage.getUser(data.claims.sub);
        if (user) {
          return done(null, user);
        }
      }
      // Session is invalid - clear it and continue without user
      done(null, false);
    } catch (error) {
      console.error("Deserialize user error:", error);
      done(null, false);
    }
  });

  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user) {
            return done(null, false, { message: "Invalid email or password" });
          }
          if (!user.passwordHash) {
            return done(null, false, { message: "Please sign in with Google" });
          }
          const isValid = await verifyPassword(password, user.passwordHash);
          if (!isValid) {
            return done(null, false, { message: "Invalid email or password" });
          }
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    // Allow explicit callback URL override, otherwise auto-detect from Replit domain
    const callbackURL = process.env.GOOGLE_OAUTH_CALLBACK_URL || 
      `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}/api/auth/google/callback`;
    
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL,
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            let user = await storage.getUserByGoogleId(profile.id);
            
            if (!user) {
              const existingUser = await storage.getUserByEmail(profile.emails?.[0]?.value || '');
              if (existingUser) {
                user = await storage.linkGoogleAccount(existingUser.id, profile.id);
              } else {
                user = await storage.createUser({
                  email: profile.emails?.[0]?.value,
                  firstName: profile.name?.givenName,
                  lastName: profile.name?.familyName,
                  profileImageUrl: profile.photos?.[0]?.value,
                  googleId: profile.id,
                  authProvider: 'google',
                  emailVerified: true,
                });
              }
            }
            
            return done(null, user);
          } catch (error) {
            return done(error as Error);
          }
        }
      )
    );
  }

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, name, firstName, lastName } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }
      
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "An account with this email already exists" });
      }
      
      // Parse name into first and last name
      let first = firstName;
      let last = lastName;
      if (name && !firstName) {
        const nameParts = name.trim().split(/\s+/);
        first = nameParts[0] || '';
        last = nameParts.slice(1).join(' ') || '';
      }
      
      const passwordHash = await hashPassword(password);
      const user = await storage.createUser({
        email,
        passwordHash,
        firstName: first,
        lastName: last,
        authProvider: 'local',
      });
      
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Login failed after registration" });
        }
        return res.json({ 
          id: user.id, 
          email: user.email, 
          firstName: user.firstName,
          lastName: user.lastName,
          onboardingCompleted: user.onboardingCompleted 
        });
      });
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(500).json({ message: error.message || "Registration failed" });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ message: "Authentication error" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      req.login(user, (loginErr) => {
        if (loginErr) {
          return res.status(500).json({ message: "Login failed" });
        }
        return res.json({ 
          id: user.id, 
          email: user.email, 
          firstName: user.firstName,
          lastName: user.lastName,
          onboardingCompleted: user.onboardingCompleted 
        });
      });
    })(req, res, next);
  });

  app.get("/api/auth/google", (req: any, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(501).json({ message: "Google authentication not configured" });
    }
    
    // Generate CSRF state token and store in session
    const state = crypto.randomBytes(32).toString('hex');
    req.session.oauthState = state;
    req.session.oauthStateCreatedAt = Date.now();
    
    // Force session save before redirect
    req.session.save((err: any) => {
      if (err) {
        console.error("Failed to save OAuth state to session:", err);
        return res.redirect("/auth?error=session_error");
      }
      
      passport.authenticate("google", { 
        scope: ["profile", "email"],
        state 
      })(req, res, next);
    });
  });

  app.get("/api/auth/google/callback", (req: any, res, next) => {
    // Validate CSRF state
    const state = req.query.state as string;
    if (!state) {
      console.error("OAuth callback missing state parameter");
      return res.redirect("/auth?error=missing_state");
    }
    
    // Validate state matches session
    const storedState = req.session.oauthState;
    const stateCreatedAt = req.session.oauthStateCreatedAt;
    
    if (!storedState) {
      console.error("OAuth callback: no state in session");
      return res.redirect("/auth?error=session_expired");
    }
    
    if (storedState !== state) {
      console.error("OAuth callback: state mismatch - potential CSRF");
      delete req.session.oauthState;
      delete req.session.oauthStateCreatedAt;
      return res.redirect("/auth?error=state_mismatch");
    }
    
    // Check state expiration (10 minutes)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    if (stateCreatedAt && stateCreatedAt < tenMinutesAgo) {
      console.error("OAuth callback: state expired");
      delete req.session.oauthState;
      delete req.session.oauthStateCreatedAt;
      return res.redirect("/auth?error=state_expired");
    }
    
    // Clear state after validation (one-time use)
    delete req.session.oauthState;
    delete req.session.oauthStateCreatedAt;
    
    passport.authenticate("google", { 
      failureRedirect: "/auth?error=google_failed" 
    })(req, res, next);
  }, (req, res) => {
    res.redirect("/");
  });

  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      req.session.destroy((sessionErr) => {
        res.clearCookie('connect.sid');
        res.json({ message: "Logged out successfully" });
      });
    });
  });

  app.get("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.redirect("/login?error=logout_failed");
      }
      req.session.destroy((sessionErr) => {
        res.clearCookie('connect.sid');
        res.redirect("/login");
      });
    });
  });

  // Forgot password - request reset
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      const user = await storage.getUserByEmail(email);
      
      // Always return success to prevent email enumeration attacks
      if (!user) {
        return res.json({ message: "If an account exists with that email, you will receive a password reset link." });
      }
      
      // Check if user uses Google auth only (no password)
      if (user.authProvider === 'google' && !user.passwordHash) {
        return res.json({ message: "If an account exists with that email, you will receive a password reset link." });
      }
      
      // Generate secure reset token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry
      
      // Store the reset token
      await storage.createPasswordResetToken({
        userId: user.id,
        token,
        expiresAt,
      });
      
      // In production, this would send an email with the reset link
      // For now, we'll just return success and log the token for testing
      const resetUrl = `${req.protocol}://${req.get('host')}/auth/reset-password?token=${token}`;
      console.log(`Password reset requested for ${email}. Reset URL: ${resetUrl}`);
      
      res.json({ 
        message: "If an account exists with that email, you will receive a password reset link.",
        // Only include token in development for testing
        ...(process.env.NODE_ENV !== 'production' && { resetToken: token, resetUrl })
      });
    } catch (error: any) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "An error occurred. Please try again." });
    }
  });

  // Reset password - verify token and set new password
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({ message: "Token and password are required" });
      }
      
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }
      
      // Find the reset token
      const resetToken = await storage.getPasswordResetToken(token);
      
      if (!resetToken) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }
      
      // Check if token is expired
      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({ message: "Reset token has expired. Please request a new one." });
      }
      
      // Check if token has already been used
      if (resetToken.used) {
        return res.status(400).json({ message: "This reset token has already been used" });
      }
      
      // Hash the new password and update user
      const passwordHash = await hashPassword(password);
      const updatedUser = await storage.updateUserPassword(resetToken.userId, passwordHash);
      
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update password" });
      }
      
      // Mark token as used
      await storage.markPasswordResetTokenUsed(token);
      
      res.json({ message: "Password has been reset successfully. You can now log in with your new password." });
    } catch (error: any) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "An error occurred. Please try again." });
    }
  });

  // Verify reset token (optional - for checking if token is valid before showing form)
  app.get("/api/auth/verify-reset-token", async (req, res) => {
    try {
      const { token } = req.query;
      
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ valid: false, message: "Token is required" });
      }
      
      const resetToken = await storage.getPasswordResetToken(token);
      
      if (!resetToken) {
        return res.status(400).json({ valid: false, message: "Invalid reset token" });
      }
      
      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({ valid: false, message: "Reset token has expired" });
      }
      
      if (resetToken.used) {
        return res.status(400).json({ valid: false, message: "Reset token has already been used" });
      }
      
      res.json({ valid: true });
    } catch (error: any) {
      console.error("Verify reset token error:", error);
      res.status(500).json({ valid: false, message: "An error occurred" });
    }
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};

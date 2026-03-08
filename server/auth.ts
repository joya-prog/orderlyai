import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { authenticator } from "otplib";
import { Resend } from "resend";
import { storage } from "./storage";
import { sendSms2FACode, verifySms2FACode, sendSignupNotification } from "./twilioClient";

// Resend email client
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Orderly AI <noreply@getorderly.io>";

async function sendPasswordResetEmail(toEmail: string, resetUrl: string): Promise<void> {
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not set — skipping email send. Reset URL:", resetUrl);
    return;
  }

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: toEmail,
    subject: "Reset your Orderly AI password",
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9f7f4; margin: 0; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 40px; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
            <div style="margin-bottom: 28px;">
              <h1 style="font-size: 22px; font-weight: 700; color: #1a1a1a; margin: 0 0 8px 0;">Reset your password</h1>
              <p style="color: #666; font-size: 15px; margin: 0;">You requested a password reset for your Orderly AI account.</p>
            </div>
            <a href="${resetUrl}" style="display: inline-block; background: #2d6a4f; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 15px; font-weight: 600; margin-bottom: 28px;">
              Reset Password
            </a>
            <p style="color: #999; font-size: 13px; margin: 0 0 8px 0;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
            <p style="color: #bbb; font-size: 12px; margin: 0;">Orderly AI · Voice Agent Platform for Restaurants</p>
          </div>
        </body>
      </html>
    `,
  });

  if (error) {
    console.error("[Email] Failed to send password reset email:", error);
    throw new Error(`Email send failed: ${error.message}`);
  }

  console.log(`[Email] Password reset email sent to ${toEmail}`);
}

const SALT_ROUNDS = 12;

// Store pending 2FA sessions temporarily (in production, use Redis)
const pending2FASessions = new Map<string, { userId: string; expiresAt: Date }>();
// Track which user has a pending session to enforce single token per user
const userToPendingToken = new Map<string, string>();

// Clean up expired pending sessions periodically
setInterval(() => {
  const now = new Date();
  const entries = Array.from(pending2FASessions.entries());
  for (const [token, session] of entries) {
    if (session.expiresAt < now) {
      pending2FASessions.delete(token);
      userToPendingToken.delete(session.userId);
    }
  }
}, 60000); // Clean up every minute

// Helper to create a new pending 2FA session (invalidates any existing for this user)
function createPending2FASession(userId: string): string {
  // Invalidate any existing pending session for this user
  const existingToken = userToPendingToken.get(userId);
  if (existingToken) {
    pending2FASessions.delete(existingToken);
  }
  
  // Create new pending session
  const pendingToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  pending2FASessions.set(pendingToken, { userId, expiresAt });
  userToPendingToken.set(userId, pendingToken);
  
  return pendingToken;
}

// Helper to clear pending session
function clearPending2FASession(token: string) {
  const session = pending2FASessions.get(token);
  if (session) {
    userToPendingToken.delete(session.userId);
    pending2FASessions.delete(token);
  }
}

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
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
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
    
    console.log('[Google OAuth] Initializing with callbackURL:', callbackURL);
    console.log('[Google OAuth] GOOGLE_OAUTH_CALLBACK_URL env:', process.env.GOOGLE_OAUTH_CALLBACK_URL || '(not set, using REPLIT_DOMAINS)');
    console.log('[Google OAuth] REPLIT_DOMAINS:', process.env.REPLIT_DOMAINS);
    
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
                sendSignupNotification({ email: user.email || 'Unknown', signupMethod: 'Google OAuth' }).catch(console.error);
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
      
      sendSignupNotification({ email: user.email || 'Unknown', signupMethod: 'Email/Password' }).catch(console.error);
      
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
    passport.authenticate("local", async (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ message: "Authentication error" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      
      // Check if user has 2FA enabled
      try {
        const twoFactor = await storage.getTwoFactorAuth(user.id);
        if (twoFactor?.isEnabled) {
          // Create a pending 2FA session token (invalidates any existing)
          const pendingToken = createPending2FASession(user.id);
          
          // Check if SMS is the preferred method and phone is set up
          const usesSms = twoFactor.smsEnabled && twoFactor.phoneNumber && twoFactor.preferredMethod === 'sms';
          
          if (usesSms && twoFactor.phoneNumber) {
            // Send SMS code
            const smsResult = await sendSms2FACode(twoFactor.phoneNumber, user.id);
            if (!smsResult.success) {
              console.error("Failed to send SMS 2FA code:", smsResult.error);
              // Fall back to TOTP if SMS fails
              return res.json({
                requires2FA: true,
                pendingToken,
                method: 'totp',
                message: "SMS failed, please use your authenticator app"
              });
            }
            
            return res.json({
              requires2FA: true,
              pendingToken,
              method: 'sms',
              phoneLastFour: twoFactor.phoneNumber.slice(-4),
              message: "Verification code sent to your phone"
            });
          }
          
          return res.json({
            requires2FA: true,
            pendingToken,
            method: 'totp',
            message: "Two-factor authentication required"
          });
        }
      } catch (error) {
        console.error("Error checking 2FA status:", error);
        // Continue with login if 2FA check fails
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
    passport.authenticate("google", {
      scope: ["profile", "email"],
    })(req, res, next);
  });

  app.get("/api/auth/google/callback", (req: any, res, next) => {
    passport.authenticate("google", async (err: any, user: any) => {
      if (err || !user) {
        console.error("Google OAuth failed:", err?.message || err, "user present:", !!user);
        return res.redirect("/auth?error=google_failed");
      }
      
      // Check if user has 2FA enabled
      try {
        const twoFactor = await storage.getTwoFactorAuth(user.id);
        if (twoFactor?.isEnabled) {
          // Create a pending 2FA session (invalidates any existing)
          const pendingToken = createPending2FASession(user.id);
          
          // Check if SMS is the preferred method
          const usesSms = twoFactor.smsEnabled && twoFactor.phoneNumber && twoFactor.preferredMethod === 'sms';
          let method = 'totp';
          
          if (usesSms && twoFactor.phoneNumber) {
            const smsResult = await sendSms2FACode(twoFactor.phoneNumber, user.id);
            if (smsResult.success) {
              method = 'sms';
            }
          }
          
          // Store token in session instead of URL for better security
          req.session.pending2FAToken = pendingToken;
          req.session.pending2FAMethod = method;
          if (method === 'sms' && twoFactor.phoneNumber) {
            req.session.pending2FAPhoneLast4 = twoFactor.phoneNumber.slice(-4);
          }
          req.session.save((saveErr: any) => {
            if (saveErr) {
              console.error("Failed to save 2FA token to session:", saveErr);
              return res.redirect("/auth?error=session_error");
            }
            return res.redirect("/auth?requires2fa=true");
          });
          return;
        }
      } catch (error) {
        console.error("Error checking 2FA status for Google auth:", error);
      }
      
      // Complete login if no 2FA
      req.login(user, (loginErr: any) => {
        if (loginErr) {
          return res.redirect("/auth?error=login_failed");
        }
        req.session.save((saveErr: any) => {
          if (saveErr) {
            console.error("Failed to save session after Google OAuth login:", saveErr);
          }
          return res.redirect("/");
        });
      });
    })(req, res, next);
  });

  // Get pending 2FA token from session (for Google OAuth flow)
  app.get("/api/auth/2fa/pending-token", (req: any, res) => {
    const pendingToken = req.session?.pending2FAToken;
    if (pendingToken) {
      const method = req.session?.pending2FAMethod || 'totp';
      const phoneLastFour = req.session?.pending2FAPhoneLast4;
      
      // Clear from session after retrieval (single use)
      delete req.session.pending2FAToken;
      delete req.session.pending2FAMethod;
      delete req.session.pending2FAPhoneLast4;
      
      return res.json({ pendingToken, method, phoneLastFour });
    }
    return res.status(404).json({ message: "No pending 2FA session" });
  });

  // Cancel pending 2FA session (user abandoned verification)
  app.post("/api/auth/2fa/cancel", (req: any, res) => {
    const { pendingToken } = req.body;
    
    // Clear from session if present
    if (req.session?.pending2FAToken) {
      delete req.session.pending2FAToken;
    }
    
    // Clear from Map if token provided
    if (pendingToken) {
      clearPending2FASession(pendingToken);
    }
    
    res.json({ message: "2FA session cancelled" });
  });

  // Verify SMS 2FA code and complete login
  app.post("/api/auth/2fa/verify-sms", async (req: any, res) => {
    try {
      const { pendingToken, code } = req.body;
      
      if (!pendingToken || !code) {
        return res.status(400).json({ message: "Token and code are required" });
      }
      
      // Validate pending session
      const pendingSession = pending2FASessions.get(pendingToken);
      if (!pendingSession) {
        return res.status(401).json({ message: "Invalid or expired session. Please log in again." });
      }
      
      // Check if pending session expired
      if (pendingSession.expiresAt < new Date()) {
        clearPending2FASession(pendingToken);
        return res.status(401).json({ message: "Session expired. Please log in again." });
      }
      
      // Get user and 2FA config
      const user = await storage.getUser(pendingSession.userId);
      if (!user) {
        clearPending2FASession(pendingToken);
        return res.status(401).json({ message: "User not found" });
      }
      
      const twoFactor = await storage.getTwoFactorAuth(pendingSession.userId);
      if (!twoFactor?.smsEnabled || !twoFactor?.phoneNumber) {
        clearPending2FASession(pendingToken);
        return res.status(400).json({ message: "SMS 2FA not configured" });
      }
      
      // Verify SMS code
      const isValid = verifySms2FACode(twoFactor.phoneNumber, user.id, code);
      
      if (!isValid) {
        return res.status(401).json({ message: "Invalid or expired verification code" });
      }
      
      // Clear pending session
      clearPending2FASession(pendingToken);
      
      // Complete login
      req.login(user, (loginErr: any) => {
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
    } catch (error) {
      console.error("Error verifying SMS 2FA:", error);
      res.status(500).json({ message: "Verification failed" });
    }
  });

  // Resend SMS 2FA code
  app.post("/api/auth/2fa/resend-sms", async (req: any, res) => {
    try {
      const { pendingToken } = req.body;
      
      if (!pendingToken) {
        return res.status(400).json({ message: "Token is required" });
      }
      
      // Validate pending session
      const pendingSession = pending2FASessions.get(pendingToken);
      if (!pendingSession) {
        return res.status(401).json({ message: "Invalid or expired session. Please log in again." });
      }
      
      // Check if pending session expired
      if (pendingSession.expiresAt < new Date()) {
        clearPending2FASession(pendingToken);
        return res.status(401).json({ message: "Session expired. Please log in again." });
      }
      
      // Get 2FA config
      const twoFactor = await storage.getTwoFactorAuth(pendingSession.userId);
      if (!twoFactor?.smsEnabled || !twoFactor?.phoneNumber) {
        return res.status(400).json({ message: "SMS 2FA not configured" });
      }
      
      // Send new SMS code
      const smsResult = await sendSms2FACode(twoFactor.phoneNumber, pendingSession.userId);
      if (!smsResult.success) {
        return res.status(500).json({ message: "Failed to send SMS code" });
      }
      
      res.json({ 
        message: "Verification code sent",
        phoneLastFour: twoFactor.phoneNumber.slice(-4)
      });
    } catch (error) {
      console.error("Error resending SMS 2FA:", error);
      res.status(500).json({ message: "Failed to send code" });
    }
  });

  // Verify 2FA code and complete login
  app.post("/api/auth/2fa/verify-login", async (req: any, res) => {
    try {
      const { pendingToken, code } = req.body;
      
      if (!pendingToken || !code) {
        return res.status(400).json({ message: "Token and code are required" });
      }
      
      // Validate pending session
      const pendingSession = pending2FASessions.get(pendingToken);
      if (!pendingSession) {
        return res.status(401).json({ message: "Invalid or expired session. Please log in again." });
      }
      
      // Check if pending session expired
      if (pendingSession.expiresAt < new Date()) {
        clearPending2FASession(pendingToken);
        return res.status(401).json({ message: "Session expired. Please log in again." });
      }
      
      // Get user and 2FA config
      const user = await storage.getUser(pendingSession.userId);
      if (!user) {
        clearPending2FASession(pendingToken);
        return res.status(401).json({ message: "User not found" });
      }
      
      const twoFactor = await storage.getTwoFactorAuth(pendingSession.userId);
      if (!twoFactor?.secret) {
        clearPending2FASession(pendingToken);
        return res.status(400).json({ message: "2FA not configured" });
      }
      
      // Verify TOTP code
      const isValid = authenticator.verify({ token: code, secret: twoFactor.secret });
      
      if (!isValid) {
        return res.status(401).json({ message: "Invalid verification code" });
      }
      
      // Clear pending session
      clearPending2FASession(pendingToken);
      
      // Complete login
      req.login(user, (loginErr: any) => {
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
    } catch (error) {
      console.error("Error verifying 2FA:", error);
      res.status(500).json({ message: "Verification failed" });
    }
  });

  // Verify backup code and complete login
  app.post("/api/auth/2fa/verify-backup", async (req: any, res) => {
    try {
      const { pendingToken, backupCode } = req.body;
      
      if (!pendingToken || !backupCode) {
        return res.status(400).json({ message: "Token and backup code are required" });
      }
      
      // Validate pending session
      const pendingSession = pending2FASessions.get(pendingToken);
      if (!pendingSession) {
        return res.status(401).json({ message: "Invalid or expired session. Please log in again." });
      }
      
      // Check if pending session expired
      if (pendingSession.expiresAt < new Date()) {
        clearPending2FASession(pendingToken);
        return res.status(401).json({ message: "Session expired. Please log in again." });
      }
      
      // Get user and 2FA config
      const user = await storage.getUser(pendingSession.userId);
      if (!user) {
        clearPending2FASession(pendingToken);
        return res.status(401).json({ message: "User not found" });
      }
      
      const twoFactor = await storage.getTwoFactorAuth(pendingSession.userId);
      if (!twoFactor?.backupCodes || twoFactor.backupCodes.length === 0) {
        return res.status(400).json({ message: "No backup codes available" });
      }
      
      // Check backup code against hashed codes
      const normalizedCode = backupCode.trim().toUpperCase();
      let matchedIndex = -1;
      
      for (let i = 0; i < twoFactor.backupCodes.length; i++) {
        const isMatch = await bcrypt.compare(normalizedCode, twoFactor.backupCodes[i]);
        if (isMatch) {
          matchedIndex = i;
          break;
        }
      }
      
      if (matchedIndex === -1) {
        return res.status(401).json({ message: "Invalid backup code" });
      }
      
      // Remove used backup code
      const updatedCodes = [...twoFactor.backupCodes];
      updatedCodes.splice(matchedIndex, 1);
      await storage.updateTwoFactorAuth(pendingSession.userId, { backupCodes: updatedCodes });
      
      // Clear pending session
      clearPending2FASession(pendingToken);
      
      // Complete login
      req.login(user, (loginErr: any) => {
        if (loginErr) {
          return res.status(500).json({ message: "Login failed" });
        }
        return res.json({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          onboardingCompleted: user.onboardingCompleted,
          remainingBackupCodes: updatedCodes.length
        });
      });
    } catch (error) {
      console.error("Error verifying backup code:", error);
      res.status(500).json({ message: "Verification failed" });
    }
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
      
      // Invalidate any prior reset tokens for this user
      await storage.invalidatePriorResetTokens(user.id);
      
      // Generate secure reset token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry
      
      // Store the reset token
      await storage.createPasswordResetToken({
        userId: user.id,
        token,
        expiresAt,
      });
      
      // Build reset URL — use production domain if available
      const host = process.env.NODE_ENV === 'production'
        ? (process.env.REPLIT_DOMAINS?.split(',').find(d => !d.includes('replit.dev')) || req.get('host'))
        : req.get('host');
      const resetUrl = `${req.protocol}://${host}/auth/reset-password?token=${token}`;

      // Send the reset email via Resend
      try {
        await sendPasswordResetEmail(email, resetUrl);
      } catch (emailError) {
        console.error("Failed to send reset email:", emailError);
        // Don't expose email failure to the user — still return success
      }

      console.log(`[Auth] Password reset requested for ${email}.`);

      res.json({ 
        message: "If an account exists with that email, you will receive a password reset link.",
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

export const isAdmin: RequestHandler = (req: any, res, next) => {
  if (req.isAuthenticated() && (req.user?.role === 'admin' || req.user?.role === 'support' || req.user?.role === 'billing')) {
    return next();
  }
  return res.status(403).json({ message: "Forbidden" });
};

export const isSuperAdmin: RequestHandler = (req: any, res, next) => {
  if (req.isAuthenticated() && req.user?.role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: "Forbidden" });
};

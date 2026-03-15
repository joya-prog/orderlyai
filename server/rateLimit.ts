// Rate limiting configuration for Orderly AI Studio
import rateLimit from 'express-rate-limit';
import { Express } from 'express';

// General API limit - 100 requests per 15 minutes per IP
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { 
    error: 'Too many requests', 
    message: 'Please try again later' 
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limit for auth endpoints - 5 attempts per 15 minutes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  skipSuccessfulRequests: true, // Don't count successful logins
  message: { 
    error: 'Too many login attempts', 
    message: 'Please try again in 15 minutes' 
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limit for webhook endpoints - 50 requests per minute
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50,
  message: { 
    error: 'Webhook rate limit exceeded' 
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limits to Express app
export function applyRateLimits(app: Express) {
  // Apply general API limit to all routes
  app.use('/api/', apiLimiter);
  
  // Apply stricter auth limit to auth endpoints
  app.use('/api/auth/', authLimiter);
  
  // Apply webhook limit to webhook endpoints
  app.use('/api/stripe/webhook', webhookLimiter);
  app.use('/api/twilio/webhook', webhookLimiter);
  
  console.log('[RateLimit] Rate limiting applied');
}

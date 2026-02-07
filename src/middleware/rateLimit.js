import { config } from '../config.js';

// Simple in-memory rate limiter
const userActions = new Map();

export function rateLimitMiddleware(ctx, next) {
  const userId = ctx.from?.id;
  
  if (!userId) {
    return next();
  }
  
  const now = Date.now();
  const userKey = userId;
  
  if (!userActions.has(userKey)) {
    userActions.set(userKey, []);
  }
  
  const actions = userActions.get(userKey);
  
  // Remove old actions outside the window
  const validActions = actions.filter(
    (timestamp) => now - timestamp < config.rateLimitWindow
  );
  
  if (validActions.length >= config.rateLimitMax) {
    // Rate limit exceeded
    console.log(`⚠️  Rate limit exceeded for user ${userId}`);
    return; // Silently ignore
  }
  
  validActions.push(now);
  userActions.set(userKey, validActions);
  
  // Cleanup old entries periodically
  if (Math.random() < 0.01) {
    for (const [key, timestamps] of userActions.entries()) {
      const valid = timestamps.filter((t) => now - t < config.rateLimitWindow);
      if (valid.length === 0) {
        userActions.delete(key);
      } else {
        userActions.set(key, valid);
      }
    }
  }
  
  return next();
}

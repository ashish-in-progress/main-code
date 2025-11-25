// ==================== src/middleware/auth.js ====================

/**
 * Middleware to require authentication
 */
export function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

/**
 * Middleware to require broker authentication
 */
export function requireBrokerAuth(broker) {
  return (req, res, next) => {
    const sessionId = req.session.sessionId;
    
    if (!sessionId) {
      return res.status(401).json({ 
        success: false, 
        error: 'No session found' 
      });
    }

    // Check broker-specific authentication
    switch (broker.toLowerCase()) {
      case 'fyers':
        // Will be checked in controller
        break;
      case 'kite':
        // Will be checked in controller
        break;
      case 'upstox':
        if (!req.session.upstoxAccessToken) {
          return res.status(401).json({ 
            success: false, 
            error: 'Not authenticated with Upstox' 
          });
        }
        break;
      default:
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid broker' 
        });
    }

    next();
  };
}

/**
 * Optional: Middleware to log requests
 */
export function logRequest(req, res, next) {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
}
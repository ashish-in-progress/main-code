
// ==================== src/utils/logger.js ====================
class Logger {
  info(msg) {
    console.log(`[INFO] ${new Date().toISOString()} - ${msg}`);
  }
  
  error(msg, error = null) {
    console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, error || '');
  }
  
  warn(msg) {
    console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`);
  }
}

export const logger = new Logger();
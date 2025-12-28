/**
 * Error Handler Module
 * Centralized error handling and formatting
 */

class ErrorHandler {
  static sendError(res, err, statusCode = 500) {
    const message = err.message || 'Unknown error';
    const code = err.code || 'INTERNAL_ERROR';

    console.error(`[${code}] ${message}`);

    return res.status(statusCode).json({
      success: false,
      message,
      code,
      timestamp: new Date().toISOString()
    });
  }

  static handleValidationError(res, field, message) {
    return res.status(400).json({
      success: false,
      message: message || `Invalid ${field}`,
      field,
      timestamp: new Date().toISOString()
    });
  }

  static handleNotFound(res, resource = 'Resource') {
    return res.status(404).json({
      success: false,
      message: `${resource} not found`,
      timestamp: new Date().toISOString()
    });
  }

  static handleUnauthorized(res) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = { ErrorHandler };

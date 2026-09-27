/**
 * Strict Content-Type Validation Middleware
 * Enforces valid MIME types for state-changing HTTP methods (POST, PUT, PATCH).
 * Rejects unexpected content types to mitigate smuggling and serialization attacks.
 */

const ALLOWED_CONTENT_TYPES = [
  'application/json',
  'application/x-www-form-urlencoded',
  'multipart/form-data',
  'text/plain'
];

function validateContentType(req, res, next) {
  const method = req.method.toUpperCase();
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    // If request has no body (content-length === 0 or undefined), allow to proceed
    const contentLength = req.headers['content-length'];
    if (contentLength === '0') {
      return next();
    }

    const contentType = req.headers['content-type'];
    if (!contentType && contentLength && parseInt(contentLength, 10) > 0) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_CONTENT_TYPE',
        message: 'Content-Type header is required for requests with a payload body.'
      });
    }

    if (contentType) {
      const isAllowed = ALLOWED_CONTENT_TYPES.some(type =>
        contentType.toLowerCase().includes(type)
      );

      if (!isAllowed) {
        return res.status(415).json({
          success: false,
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: `Content-Type '${contentType}' is not supported. Expected application/json or multipart/form-data.`
        });
      }
    }
  }
  next();
}

module.exports = {
  validateContentType,
  ALLOWED_CONTENT_TYPES
};

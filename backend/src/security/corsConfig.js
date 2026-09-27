/**
 * Enterprise CORS Security Configuration
 * Restricts cross-origin resource sharing to verified domains only.
 * Eliminates insecure wildcard Access-Control-Allow-Origin: * with credentials.
 */

const cors = require('cors');

// Known production domains
const PRODUCTION_DOMAINS = [
  'https://bsctextiles.in',
  'https://www.bsctextiles.in',
  'https://bsctextiles.com',
  'https://www.bsctextiles.com'
];

// Local development origins
const LOCAL_DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5000',
  'http://localhost:5001',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:5000',
  'http://127.0.0.1:5001',
  'http://127.0.0.1:5173'
];

// Compile static allowed origins
const envOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const ALLOWED_ORIGIN_SET = new Set([
  ...PRODUCTION_DOMAINS,
  ...LOCAL_DEV_ORIGINS,
  ...envOrigins
]);

// LAN IP regex for local development / testing across store terminals
const LAN_IP_REGEX = /^http:\/\/(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?::\d+)?$/;

function isOriginAllowed(origin) {
  // Allow requests with no origin (e.g. mobile apps, curl, server-to-server, same-origin)
  if (!origin) return true;

  const normalized = origin.trim().replace(/\/+$/, '').toLowerCase();

  // Explicit match in allowed set
  if (ALLOWED_ORIGIN_SET.has(normalized)) return true;

  // Local LAN network match in development / staging
  if (process.env.NODE_ENV !== 'production' && LAN_IP_REGEX.test(normalized)) {
    return true;
  }

  // Hostinger subdomains or custom staging domains for BSC
  if (/^https?:\/\/([a-z0-9-]+\.)?bsctextiles\.(?:in|com)$/i.test(normalized)) {
    return true;
  }

  return false;
}

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS Guard] Blocked unauthorized cross-origin request from: ${origin}`);
      callback(new Error(`CORS Policy: Access from origin ${origin} is not permitted.`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-CSRF-Token',
    'X-Location-Id',
    'X-App-No',
    'X-Candidate-Name',
    'Accept',
    'Origin'
  ],
  exposedHeaders: [
    'Content-Range',
    'X-Content-Range',
    'X-WAF-Protection',
    'X-Correlation-ID'
  ],
  maxAge: 86400 // Cache preflight requests for 24 hours
};

module.exports = {
  corsMiddleware: cors(corsOptions),
  isOriginAllowed
};

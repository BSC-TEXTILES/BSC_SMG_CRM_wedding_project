# BSC Enterprise Operations Portal - Login Flow Tests

## Overview

This document describes the comprehensive fixes made to the BSC Enterprise Operations Portal login system and provides instructions for testing the login flow.

## Credentials

The system has been seeded with the following default accounts:

| Username | Password | Role | Dashboard |
|----------|----------|------|----------|
| admin@bsctextiles.com | admin@2026 | Admin | Admin Dashboard |
| hr@bsctextiles.com | bsc@2026 | HR | HR Dashboard |
| manager@bsctextiles.com | bsc@2026 | Manager | Manager Dashboard |
| greeter@bsctextiles.com | bsc@123 | Greeter | Greeter Dashboard |

## Fixes Applied

### 1. Fixed API Error Messages (HTTP 404 Issue)

**Problem**: When API calls failed with a 404 status, the error message was literally "HTTP 404" which was confusing to users.

**Solution**: Enhanced `frontend/src/services/api.ts` to provide user-friendly error messages based on HTTP status codes:
- 401: Authentication failed. Please check your credentials.
- 403: Access denied. You do not have permission to perform this action.
- 404: The requested resource was not found. Please contact your administrator.
- 423: Account temporarily locked due to too many failed attempts. Please try again later.
- 429: Too many requests. Please wait and try again.
- 500/503: Server error. Please try again or contact your administrator.

### 2. Fixed Database Table Compatibility

**Problem**: The authentication service was trying to query both `users` (lowercase) and `User` (capital U) tables, but the queries were inconsistent.

**Solution**: Enhanced `backend/src/services/authService.js` to:
- Try both `users` and `User` tables with proper fallback logic
- Handle different column names (`active` vs `status`) across table variants
- Support both table structures for compatibility across deployments
- Log helpful debug messages when queries fail

### 3. Made Forgot Password Functional

**Problem**: The "Forgot password?" button only showed a toast message.

**Solution**: Implemented a complete password reset flow:

#### Backend Changes:
- Added `requestPasswordReset` endpoint (`POST /api/auth/request-password-reset`)
- Added `verifyPasswordResetToken` endpoint (`GET /api/auth/verify-password-reset-token`)
- Added `resetPassword` endpoint (`POST /api/auth/reset-password`)
- All endpoints are CSRF-exempt for public access
- Tokens are stored in the `PasswordReset` table with 1-hour expiry
- Security events are logged for all password reset activities

#### Frontend Changes:
- Created new page: `frontend/src/pages/ForgotPassword.tsx`
- Added API methods in `frontend/src/services/api.ts`:
  - `API.requestPasswordReset(email)`
  - `API.verifyPasswordResetToken(token)`
  - `API.resetPassword(token, newPassword)`
- Added route in `frontend/src/App.tsx`: `/forgot-password`
- Updated Login page to navigate to `/forgot-password` instead of showing toast

### 4. Fixed Captcha Integration

**Problem**: The captcha was fetched using a direct `fetch()` call instead of the API service.

**Solution**: Updated `frontend/src/pages/Login.tsx` to use `API.getCaptcha()` method which:
- Uses the configured API base URL
- Provides consistent error handling
- Maintains proper error messages

### 5. Simplified Client-Side Password Validation

**Problem**: Overly strict password validation was blocking valid passwords.

**Solution**: Simplified the client-side validation in `frontend/src/pages/Login.tsx` to only check minimum length (4 characters). The actual password validation happens server-side against the stored bcrypt hash, which is the primary security check.

## Configuration

### Environment Variables

**Backend** (in `.env` or `.env.example`):
```
# Database
DB_HOST=localhost
DB_USER=u101820758_bsc_smg_crm
DB_PASSWORD=Btpldvg@2026
DB_NAME=u101820758_bsc_smg
DB_PORT=3306

# Security
JWT_SECRET=bsc_super_secret_dev_key_2025_change_me_in_prod
SESSION_HOURS=6

# Server
PORT=5000
NODE_ENV=development
```

**Frontend** (in `frontend/.env`):
```
VITE_API_URL=http://localhost:5000
```

### Vite Proxy Configuration

The frontend `vite.config.ts` proxies `/api` requests to the backend:
```typescript
server: {
  port: 3000,
  proxy: {
    '/api': {
      target: process.env.VITE_API_URL || 'http://localhost:5000',
      changeOrigin: true,
    },
    '/uploads': {
      target: process.env.VITE_API_URL || 'http://localhost:5000',
      changeOrigin: true,
    }
  }
}
```

## API Endpoints

### Authentication
- `GET /api/auth/captcha` - Get a new security code (captcha)
- `GET /api/auth/lock-status?username={username}` - Check if account is locked
- `POST /api/auth/login` - Authenticate user with credentials and captcha
- `POST /api/auth/verify` - Verify user credentials (alternative)
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user profile (authenticated)

### Password Reset
- `POST /api/auth/request-password-reset` - Request password reset email
- `GET /api/auth/verify-password-reset-token?token={token}` - Verify reset token
- `POST /api/auth/reset-password` - Reset password with valid token

### Health & Diagnostics
- `GET /api/health` - Health check endpoint
- `GET /api/db-status` - Database connectivity check

## Running the System

### Development

1. **Start the backend server:**
   ```bash
   cd /d/BTPL_SMG/BSC_SMG
   npm run dev:backend
   ```
   Server runs on: http://localhost:5000

2. **Start the frontend development server:**
   ```bash
   cd /d/BTPL_SMG/BSC_SMG/frontend
   npm run dev
   ```
   Frontend runs on: http://localhost:3000

3. **Access the login page:**
   Open browser to: http://localhost:3000/login

### Production

1. **Build the frontend:**
   ```bash
   cd /d/BTPL_SMG/BSC_SMG
   npm run build
   ```

2. **Start the backend server:**
   ```bash
   node index.js
   ```
   The backend will automatically serve the frontend from the `dist` directory.

3. **Access the login page:**
   Open browser to: http://your-server:3000/login

## Running Tests

To verify the login flow is working correctly:

```bash
# Install test dependencies (if not already installed)
npm install node-fetch form-data

# Run the test script
node test_login_flow.js

# Or test against a specific API URL
node test_login_flow.js --api-url http://your-server:5000/api
```

The test script will:
1. Check API health
2. Verify database connectivity
3. Test captcha generation
4. Test login with valid credentials
5. Test login with invalid credentials
6. Test account lock status
7. Test password reset request
8. Verify dashboard routing configuration
9. Check frontend routes
10. Test captcha validation

## Troubleshooting

### Common Issues

#### 1. "The requested resource was not found" (404)
- **Check**: Ensure the backend server is running
- **Check**: Verify the API URL in frontend configuration
- **Check**: Ensure the proxy is configured correctly in `vite.config.ts`
- **Check**: Verify the route exists in `backend/src/routes/api.js`

#### 2. Database connection errors
- **Check**: Verify database credentials in `.env` file
- **Check**: Ensure the database server is running
- **Check**: Verify the database name and user permissions
- **Solution**: Run the database initialization scripts in `database/` folder

#### 3. Invalid credentials error with correct password
- **Check**: Ensure the admin user is seeded (run `npm run seed`)
- **Check**: Verify the password hash in the database
- **Note**: The default admin password is `admin@2026`

#### 4. Captcha not displaying
- **Check**: Ensure the captcha endpoint is accessible
- **Check**: Verify no CSRF protection is blocking the request
- **Check**: The captcha routes are CSRF-exempt

#### 5. CORS errors
- **Solution**: The backend already has CORS configured with:
  ```javascript
  app.use(cors({ origin: '*', credentials: true }));
  ```
- **Check**: Ensure the frontend is making requests to the correct URL

### Debug Mode

The backend has debug logging enabled. Check the console output for:
- `[DEBUG] API request:` - Shows incoming API requests
- `[MySQL DB] CONNECTED` - Database connection status
- `[AuthController.login]` - Login attempts
- `[Captcha]` - Captcha generation and verification

## Security Features

### Rate Limiting
- Login endpoint: 50 attempts per 10 minutes per IP
- Global API: 500 requests per 15 minutes per IP

### Account Lockout
- After 5 failed login attempts, account is locked for 10 minutes
- Lock applies to both username and IP address
- Lock status is checked before each login attempt

### Captcha Security
- 4-digit numeric code
- Automatically refreshes every 30 seconds
- One-time use only
- Server-side validation only

### Password Security
- Passwords are stored as bcrypt hashes (cost factor: 12)
- Legacy plaintext passwords are automatically upgraded on first login
- Password reset tokens expire after 1 hour
- Password reset tokens are single-use

## Files Modified

### Backend
1. `backend/src/controllers/authController.js` - Added password reset methods
2. `backend/src/routes/api.js` - Added password reset routes
3. `backend/src/middleware/csrf.js` - Added password reset routes to CSRF exempt list
4. `backend/src/services/authService.js` - Improved database table compatibility

### Frontend
1. `frontend/src/pages/Login.tsx` - Fixed captcha fetch, password validation, forgot password button
2. `frontend/src/pages/ForgotPassword.tsx` - New page for password reset
3. `frontend/src/services/api.ts` - Added user-friendly error messages, password reset API methods
4. `frontend/src/App.tsx` - Added forgot-password route

### Test
1. `test_login_flow.js` - New comprehensive test script
2. `TEST_LOGIN.md` - This documentation file

## Verification Checklist

Before deploying to production, verify:

- [ ] Backend server starts without errors
- [ ] Database connection is successful
- [ ] All tables are created (users, User, locations, PasswordReset, etc.)
- [ ] Admin user exists with correct password
- [ ] API endpoints are accessible
- [ ] Frontend can fetch captcha
- [ ] Login with admin@bsctextiles.com / admin@2026 works
- [ ] Role-based dashboard routing works
- [ ] Forgot password flow works
- [ ] Security code validation works
- [ ] Invalid credentials show proper error messages
- [ ] Account lockout works after 5 failed attempts
- [ ] Locked account recovers after 10 minutes

## Contact

For issues with the login system, contact the System Administrator.

# BSC Textiles Portal — Technical Reference

Welcome to the internal technical reference (DOCME) for the BSC Textiles Portal.

## Developer Guidelines

### 1. File Structure
- Frontend components should remain stateless where possible.
- Complex state should be handled at the Page level.
- Backend controllers should remain thin; offload complex logic to Services (e.g., \`auditService\`, \`authorizationService\`).

### 2. Security First
- Never console.log() passwords, PINs, or tokens.
- Always use the \`userValidator.js\` middleware for creating or updating users.
- Route all audit logging through \`auditService.log()\` to ensure consistent formatting and automatic sensitive data redaction.

### 3. Location Boundaries
- **CRITICAL:** When adding new database tables, always include a \`location_id\` column unless it's a global setting.
- Always use the \`authorizeLocationAccess\` middleware to ensure a user cannot act on another location's data.

### 4. Developer Tools
- Access \`/developer-tools\` in the UI (Admin only) to view API health, Database status, Route explorer, and real-time logs.
- The DevTools backend controllers (\`devToolsController.js\`) must strictly filter out environment variable values that are sensitive (see the \`SECRET_KEYS\` array in the controller).

## Deployment

The application is deployed on Hostinger via Passenger.
- The entry point must remain \`index.js\` in the root/backend directory.
- Passenger automatically provides the \`PORT\` environment variable. The app must listen on this port. Do not hardcode port 3000 or 5000 in production.

/**
 * LOCAL DEVELOPMENT ENTRY POINT
 * Run: node backend/src/index.js
 *
 * backend/index.js creates the HTTP server and calls listen() itself —
 * Phusion Passenger requires that listen() be called from the entry file.
 * Calling app.listen() a second time here raises EADDRINUSE on a second
 * server instance and crashes the process, so this file only bootstraps it.
 *
 * On Hostinger (Passenger), use hrms-system/index.js instead.
 */

const app = require('../index.js');

module.exports = app;

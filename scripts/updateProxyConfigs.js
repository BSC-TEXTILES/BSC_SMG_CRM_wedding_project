const fs = require('fs');
const path = require('path');

// 1. Update nginx.conf
const nginxFile = path.join(__dirname, '..', 'nginx.conf');
let nginx = fs.readFileSync(nginxFile, 'utf8').replace(/\r\n/g, '\n');

if (!nginx.includes('server_tokens off;')) {
  nginx = nginx.replace(
    '    # ─── SSL/TLS Configuration ────────────────────────────────────────',
    '    # Hide backend server identity\n    server_tokens off;\n    proxy_hide_header X-Powered-By;\n    proxy_hide_header Server;\n\n    # ─── SSL/TLS Configuration ────────────────────────────────────────'
  );
}

// Ensure blocking patterns cover config and all dotfiles
nginx = nginx.replace(
  /location ~ \/\.\(git\|env\|htaccess\|htpasswd\)[\s\S]*?location ~\* \\\.\(log\|sql\|bak\|backup\)\$ \{[\s\S]*?return 404;\s*\}/,
  `# ─── Block Access to Sensitive Files & Dotfiles ─────────────────────
    location ~* \\.(env|git|sql|log|bak|backup|config)$ {
        deny all;
        return 404;
    }

    location ~ /\\. {
        deny all;
        return 404;
    }`
);

fs.writeFileSync(nginxFile, nginx, 'utf8');
console.log('Updated nginx.conf');

// 2. Update Caddyfile
const caddyFile = path.join(__dirname, '..', 'Caddyfile');
let caddy = fs.readFileSync(caddyFile, 'utf8').replace(/\r\n/g, '\n');

if (!caddy.includes('-X-Powered-By')) {
  caddy = caddy.replace('-Server', '-Server\n        -X-Powered-By');
}

caddy = caddy.replace(
  '@sensitive path /.git* /.env* /.htaccess /.htpasswd *.log *.sql *.bak *.backup',
  '@sensitive path /.git* /.env* /.htaccess /.htpasswd *.log *.sql *.bak *.backup *.config'
);

fs.writeFileSync(caddyFile, caddy, 'utf8');
console.log('Updated Caddyfile');

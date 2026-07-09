// PM2 process config untuk TransityTerminal API
// Start: pm2 start deploy/pm2.config.js
// Reload tanpa downtime: pm2 reload transity-api
// Logs: pm2 logs transity-api

export default {
  apps: [
    {
      name: "transity-api",
      script: "dist/index.cjs",
      cwd: "/opt/transity-api",

      // e2-micro punya 1 vCPU shared — 1 instance sudah cukup
      instances: 1,
      exec_mode: "fork",

      // Env vars dibaca dari .env di cwd, plus override di sini
      env: {
        NODE_ENV: "production",
        SERVE_STATIC: "false",
        PORT: "5000",
      },

      // Auto-restart kalau crash
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: "10s",

      // Log ke file
      out_file: "/var/log/transity-api/out.log",
      error_file: "/var/log/transity-api/error.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      // Graceful shutdown — tunggu SIGTERM handler di server/index.ts
      kill_timeout: 10000,
      listen_timeout: 15000,
    },
  ],
};

module.exports = {
  apps: [{
    name: 'devmosel-bridge',
    script: 'index.js',
    cwd: '.',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    restart_delay: 3000,
    max_restarts: 10,
    min_uptime: '10s',
    out_file: './logs/system.log',
    error_file: './logs/system-error.log',
    log_file: './logs/system-combined.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    node_args: '--max-old-space-size=512',
    env: {
      NODE_ENV: 'production',
      NODE_VERSION: '20',
      PATH: '/home/ubuntu/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
    },
    max_memory_restart: '500M',
    kill_timeout: 10000,
    listen_timeout: 10000,
    autorestart: true,
    ignore_watch: [
      'node_modules',
      'logs',
      '.git',
      '*.log'
    ],
    source_map_support: true,
    instance_var: 'INSTANCE_ID'
  }]
};
/**
 * PM2 Ecosystem Configuration for Devmosel Bridge
 * 
 * This configuration file defines how PM2 should manage the Bridge application
 * for 24/7 availability on AWS Lightsail with automatic crash recovery.
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6
 */

module.exports = {
  apps: [{
    // Application identification
    name: 'devmosel-bridge',
    script: './index.js',
    cwd: './bridge',
    
    // Process management settings
    instances: 1,
    exec_mode: 'fork',
    
    // Auto-restart configuration (Requirement 13.2, 13.4)
    watch: false,
    restart_delay: 3000,        // Wait 3 seconds before restart
    max_restarts: 10,           // Stop trying after 10 consecutive failures
    min_uptime: '10s',          // Consider restart successful if app runs for 10s
    
    // Logging configuration (Requirement 13.3)
    out_file: './logs/system.log',
    error_file: './logs/system-error.log',
    log_file: './logs/system-combined.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Environment and runtime settings (Requirement 13.5, 13.6)
    node_args: '--max-old-space-size=512',
    env: {
      NODE_ENV: 'production',
      NODE_VERSION: '20'
    },
    
    // Health monitoring
    max_memory_restart: '500M',
    
    // Process behavior
    kill_timeout: 10000,        // Allow 10 seconds for graceful shutdown
    listen_timeout: 10000,      // Wait 10 seconds for app to be ready
    
    // Disable features not needed for this application
    autorestart: true,
    ignore_watch: [
      'node_modules',
      'logs',
      '.git',
      '*.log'
    ],
    
    // Source map support for better error reporting
    source_map_support: true,
    
    // Instance variables for monitoring
    instance_var: 'INSTANCE_ID'
  }],

  /**
   * Deployment configuration for AWS Lightsail
   * This section can be used with PM2 deploy commands
   */
  deploy: {
    production: {
      // Server connection details (to be configured per deployment)
      user: 'ubuntu',
      host: ['your-lightsail-instance.amazonaws.com'],
      ref: 'origin/main',
      repo: 'git@github.com:your-username/devmosel-bridge.git',
      path: '/home/ubuntu/devmosel-bridge',
      
      // Deployment commands
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
      
      // Environment variables for deployment
      env: {
        NODE_ENV: 'production'
      }
    }
  }
};
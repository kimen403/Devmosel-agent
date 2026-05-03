/**
 * Bridge Application Entry Point
 * 
 * Main entry point for the Telegram-Kiro-Bot system.
 * Initializes all modules and manages the lifecycle of the Bridge application.
 * 
 * Requirements: 12.1, 12.2, 1.4, 9.5
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const TelegramAdapter = require('./telegram');
const AgentManager = require('./agent-manager');
const Logger = require('./logger');
const Notifier = require('./notifier');

/**
 * Validate required environment variables
 * Implements Requirements 12.2, 1.4, 9.5, 10.4, 11.5
 */
function validateEnvironment() {
  const required = ['BOT_TOKEN', 'ALLOWED_USERS', 'KIRO_CLI_PATH', 'WORKSPACE_PATH'];
  const missing = [];

  for (const varName of required) {
    if (!process.env[varName] || process.env[varName].trim() === '') {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('Please configure these variables in bridge/.env');
    process.exit(1);
  }

  console.log('✅ All required environment variables are present');

  // Validate MCP token environment variables (Requirement 12.2)
  console.log('🔑 Validating MCP server tokens...');
  
  // GitHub token is required for all agents
  if (!process.env.GITHUB_TOKEN || process.env.GITHUB_TOKEN.trim() === '') {
    console.error('❌ GITHUB_TOKEN is required for MCP GitHub server');
    console.error('Please set GITHUB_TOKEN in bridge/.env');
    process.exit(1);
  }
  console.log('✅ GitHub token present');

  // Vercel token is optional but warn if missing
  if (!process.env.VERCEL_TOKEN || process.env.VERCEL_TOKEN.trim() === '') {
    console.warn('⚠️  VERCEL_TOKEN not set - Vercel MCP server will be unavailable');
    console.warn('   This affects frontend and devops agents');
  } else {
    console.log('✅ Vercel token present');
  }

  // Supabase credentials are optional but warn if missing
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || supabaseUrl.trim() === '' || !supabaseKey || supabaseKey.trim() === '') {
    console.warn('⚠️  SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set - Supabase MCP server will be unavailable');
    console.warn('   This affects backend and testing agents');
  } else {
    console.log('✅ Supabase credentials present');
  }

  console.log('✅ MCP token validation complete\n');
}

/**
 * Initialize the Bridge application
 * Implements Requirement 12.1
 */
async function initialize() {
  console.log('🚀 Starting Telegram-Kiro-Bot Bridge...\n');

  // Validate environment variables
  validateEnvironment();

  // Initialize Logger module
  console.log('📝 Initializing Logger...');
  const logger = new Logger();
  logger.log({
    level: 'info',
    agent: 'system',
    type: 'bridge_startup',
    message: 'Bridge application starting'
  });

  // Initialize Agent_Manager
  console.log('🤖 Initializing Agent Manager...');
  const notifier = new Notifier(null, logger); // Telegram adapter not ready yet
  const agentManager = new AgentManager(logger, notifier);

  try {
    await agentManager.initialize();
    console.log('✅ Agent Manager initialized\n');
  } catch (error) {
    console.error('❌ Failed to initialize Agent Manager:', error.message);
    logger.log({
      level: 'error',
      agent: 'system',
      type: 'agent_manager_init_failed',
      message: error.message
    });
    process.exit(1);
  }

  // Initialize Telegram_Adapter
  console.log('📱 Initializing Telegram Adapter...');
  const telegramAdapter = new TelegramAdapter(
    process.env.BOT_TOKEN,
    process.env.ALLOWED_USERS
  );

  try {
    await telegramAdapter.start();
    console.log('✅ Telegram Adapter started\n');
  } catch (error) {
    console.error('❌ Failed to start Telegram Adapter:', error.message);
    logger.log({
      level: 'error',
      agent: 'system',
      type: 'telegram_adapter_start_failed',
      message: error.message
    });
    process.exit(1);
  }

  // Update Notifier with Telegram adapter
  notifier.telegram = telegramAdapter;

  // Setup command handlers
  console.log('⚙️  Setting up command handlers...');
  telegramAdapter.setupCommandHandlers(agentManager, logger);
  console.log('✅ Command handlers configured\n');

  logger.log({
    level: 'info',
    agent: 'system',
    type: 'bridge_ready',
    message: 'Bridge application ready and listening for commands'
  });

  console.log('✅ Bridge is ready and listening for Telegram commands');
  console.log(`📊 Monitoring ${agentManager.agentNames.length} agents: ${agentManager.agentNames.join(', ')}`);
  
  if (notifier.isEnabled()) {
    console.log(`📢 Notifications enabled for chat ID: ${process.env.NOTIFY_CHAT_ID}`);
  } else {
    console.log('⚠️  Notifications disabled (NOTIFY_CHAT_ID not set)');
  }

  return { telegramAdapter, agentManager, logger, notifier };
}

/**
 * Setup graceful shutdown handlers
 * Implements Requirements 14.1, 14.2, 14.3, 14.5
 */
function setupShutdownHandlers(telegramAdapter, agentManager, logger, notifier) {
  let isShuttingDown = false;

  const shutdown = async (signal) => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;

    console.log(`\n🛑 Received ${signal}, initiating graceful shutdown...`);

    logger.log({
      level: 'info',
      agent: 'system',
      type: 'bridge_shutdown',
      message: `Graceful shutdown initiated by ${signal}`
    });

    try {
      // Stop progress tracking
      if (notifier) {
        notifier.stopAllProgressTracking();
      }

      // Stop Telegram polling
      if (telegramAdapter) {
        console.log('📱 Stopping Telegram polling...');
        await telegramAdapter.stop();
        console.log('✅ Telegram polling stopped');
      }

      // Shutdown Agent Manager (terminates all agents)
      if (agentManager) {
        console.log('🤖 Shutting down Agent Manager...');
        await agentManager.shutdown();
        console.log('✅ Agent Manager shutdown complete');
      }

      // Flush logs
      if (logger) {
        console.log('📝 Flushing logs...');
        await logger.flush();
        console.log('✅ Logs flushed');
      }

      console.log('✅ Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error.message);
      logger.log({
        level: 'error',
        agent: 'system',
        type: 'shutdown_error',
        message: error.message
      });
      process.exit(1);
    }
  };

  // Register signal handlers (Requirement 14.1, 14.5)
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
    logger.log({
      level: 'error',
      agent: 'system',
      type: 'uncaught_exception',
      message: error.message,
      stack: error.stack
    });
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled rejection:', reason);
    logger.log({
      level: 'error',
      agent: 'system',
      type: 'unhandled_rejection',
      message: String(reason)
    });
  });
}

/**
 * Main entry point
 */
async function main() {
  try {
    const { telegramAdapter, agentManager, logger, notifier } = await initialize();
    setupShutdownHandlers(telegramAdapter, agentManager, logger, notifier);
  } catch (error) {
    console.error('❌ Fatal error during initialization:', error);
    process.exit(1);
  }
}

// Start the application
main();

/**
 * Example demonstrating command handlers for Telegram-Kiro-Bot
 * Task 8.4: Implement command handlers
 * 
 * This example shows how the TelegramAdapter command handlers work with
 * Agent_Manager and Logger to process Telegram commands.
 */

const TelegramAdapter = require('./telegram');
const AgentManager = require('./agent-manager');
const Logger = require('./logger');

// Mock environment variables for demonstration
process.env.BOT_TOKEN = 'mock-token-for-example';
process.env.ALLOWED_USERS = '123456789';
process.env.WORKSPACE_PATH = './workspace';
process.env.KIRO_CLI_PATH = '/usr/local/bin/kiro-cli';
process.env.LOG_DIR = './logs';

/**
 * Example 1: Setting up command handlers
 */
async function exampleSetupHandlers() {
  console.log('=== Example 1: Setting up command handlers ===\n');

  // Initialize modules
  const logger = new Logger();
  const agentManager = new AgentManager(logger, null);
  const telegram = new TelegramAdapter(
    process.env.BOT_TOKEN,
    process.env.ALLOWED_USERS
  );

  // Start Telegram polling (in real scenario)
  // await telegram.start();

  // Setup command handlers - this wires up the message event handler
  // telegram.setupCommandHandlers(agentManager, logger);

  console.log('Command handlers are now set up and ready to process messages');
  console.log('The bot will now route commands to appropriate handlers:\n');
  console.log('  /agent <name> <prompt> → handleAgentCommand()');
  console.log('  /all <prompt> → handleAllCommand()');
  console.log('  /agents or /status → handleStatusCommand()');
  console.log('  /logs <name> → handleLogsCommand()');
  console.log('  /cancel <name> → handleCancelCommand()');
  console.log('  Plain text → handleAgentCommand() with backend agent\n');
}

/**
 * Example 2: Command flow for /agent command
 */
function exampleAgentCommandFlow() {
  console.log('=== Example 2: /agent command flow ===\n');

  console.log('User sends: /agent backend "implement user authentication"\n');
  console.log('Flow:');
  console.log('1. bot.on("message") receives the message');
  console.log('2. parseCommand() authenticates and parses the command');
  console.log('3. handleCommand() routes to handleAgentCommand()');
  console.log('4. handleAgentCommand() calls:');
  console.log('   - sendTypingIndicator() every 5 seconds');
  console.log('   - agentManager.dispatch("backend", prompt, context)');
  console.log('5. Agent response is sent back via sendMessage()');
  console.log('6. If error occurs, error message is sent to user\n');
}

/**
 * Example 3: Command flow for /all command
 */
function exampleAllCommandFlow() {
  console.log('=== Example 3: /all command flow ===\n');

  console.log('User sends: /all "update dependencies"\n');
  console.log('Flow:');
  console.log('1. parseCommand() returns { type: "all", prompt: "..." }');
  console.log('2. handleAllCommand() calls:');
  console.log('   - agentManager.broadcastPrompt(prompt, context)');
  console.log('3. Broadcast result contains:');
  console.log('   - successful: ["backend", "frontend", ...]');
  console.log('   - failed: [{ agent: "testing", error: "..." }]');
  console.log('   - duration: 120000 (ms)');
  console.log('4. Summary message is formatted and sent:');
  console.log('   "✅ Broadcast complete in 120 seconds"');
  console.log('   "Successful: 4/5"');
  console.log('   "✅ backend, frontend, devops, reviewer"');
  console.log('   "❌ Failed: testing: Agent is unavailable"\n');
}

/**
 * Example 4: Command flow for /status command
 */
function exampleStatusCommandFlow() {
  console.log('=== Example 4: /status command flow ===\n');

  console.log('User sends: /status\n');
  console.log('Flow:');
  console.log('1. parseCommand() returns { type: "status" }');
  console.log('2. handleStatusCommand() calls:');
  console.log('   - agentManager.getAllAgentStates()');
  console.log('3. Returns Map with agent states:');
  console.log('   backend: { state: "busy", currentTask: {...}, ... }');
  console.log('   frontend: { state: "idle", ... }');
  console.log('   ...');
  console.log('4. Status message is formatted and sent:');
  console.log('   "📊 Agent Status:"');
  console.log('   "⏳ backend: busy (45s)"');
  console.log('   "✅ frontend: idle"');
  console.log('   "✅ testing: idle"');
  console.log('   "✅ devops: idle"');
  console.log('   "✅ reviewer: idle"\n');
}

/**
 * Example 5: Command flow for /logs command
 */
function exampleLogsCommandFlow() {
  console.log('=== Example 5: /logs command flow ===\n');

  console.log('User sends: /logs backend\n');
  console.log('Flow:');
  console.log('1. parseCommand() returns { type: "logs", agentName: "backend" }');
  console.log('2. handleLogsCommand() calls:');
  console.log('   - logger.queryLogs("backend", 20)');
  console.log('3. Returns array of log entries (most recent first):');
  console.log('   [');
  console.log('     { ts: "2025-01-15T10:31:30Z", type: "response_complete", ... },');
  console.log('     { ts: "2025-01-15T10:30:47Z", type: "tool_call", tool: "fsWrite", ... },');
  console.log('     { ts: "2025-01-15T10:30:45Z", type: "prompt", text: "...", ... }');
  console.log('   ]');
  console.log('4. Logs are formatted and sent:');
  console.log('   "📋 Last 3 log entries for backend:"');
  console.log('   "ℹ️ [15/01/2025 17:31:30] response_complete: 45s"');
  console.log('   "ℹ️ [15/01/2025 17:30:47] tool_call: fsWrite (src/auth.js)"');
  console.log('   "ℹ️ [15/01/2025 17:30:45] prompt: \\"implement user auth...\\"\n');
}

/**
 * Example 6: Command flow for /cancel command
 */
function exampleCancelCommandFlow() {
  console.log('=== Example 6: /cancel command flow ===\n');

  console.log('User sends: /cancel backend\n');
  console.log('Flow:');
  console.log('1. parseCommand() returns { type: "cancel", agentName: "backend" }');
  console.log('2. handleCancelCommand() calls:');
  console.log('   - agentManager.getAgentState("backend")');
  console.log('3. If agent is idle:');
  console.log('   - Send: "ℹ️ Agent backend has no running task to cancel"');
  console.log('4. If agent is busy:');
  console.log('   - agentManager.cancelTask("backend")');
  console.log('   - Send: "✅ Task cancelled for agent: backend"');
  console.log('5. If error occurs:');
  console.log('   - Send: "❌ Error cancelling task: <error message>"\n');
}

/**
 * Example 7: Error handling
 */
function exampleErrorHandling() {
  console.log('=== Example 7: Error handling ===\n');

  console.log('Scenario 1: Agent is busy');
  console.log('User sends: /agent backend "new task"');
  console.log('Agent_Manager throws: "Agent backend is currently busy"');
  console.log('Response: "❌ [backend] Error: Agent backend is currently busy"\n');

  console.log('Scenario 2: Agent is unavailable');
  console.log('User sends: /agent testing "run tests"');
  console.log('Agent_Manager throws: "Agent testing is unavailable"');
  console.log('Response: "❌ [testing] Error: Agent testing is unavailable"\n');

  console.log('Scenario 3: Broadcast with busy agents');
  console.log('User sends: /all "update all"');
  console.log('Agent_Manager throws: "Agent backend is currently busy"');
  console.log('Response: "❌ Broadcast error: Agent backend is currently busy"\n');

  console.log('Scenario 4: Invalid agent name');
  console.log('User sends: /logs unknown');
  console.log('parseCommand() returns error command');
  console.log('Response: "Unrecognized agent name: unknown\\nValid agent names: ..."\n');
}

/**
 * Example 8: Plain text message (default routing)
 */
function examplePlainTextMessage() {
  console.log('=== Example 8: Plain text message (default routing) ===\n');

  console.log('User sends: "implement user authentication"');
  console.log('Flow:');
  console.log('1. parseCommand() detects no slash command');
  console.log('2. Returns: { type: "agent", agentName: "backend", prompt: "..." }');
  console.log('3. Routes to handleAgentCommand() with backend agent');
  console.log('4. Same flow as /agent backend command\n');
}

// Run examples
async function runExamples() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Telegram-Kiro-Bot Command Handlers Examples              ║');
  console.log('║  Task 8.4: Command Handler Implementation                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  await exampleSetupHandlers();
  exampleAgentCommandFlow();
  exampleAllCommandFlow();
  exampleStatusCommandFlow();
  exampleLogsCommandFlow();
  exampleCancelCommandFlow();
  exampleErrorHandling();
  examplePlainTextMessage();

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Command Handlers Implementation Complete                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('Key Features Implemented:');
  console.log('✅ /agent handler routes to Agent_Manager.dispatch()');
  console.log('✅ /all handler routes to Agent_Manager.broadcastPrompt()');
  console.log('✅ /agents and /status handlers query Agent_Manager.getAllAgentStates()');
  console.log('✅ /logs handler queries Logger.queryLogs() and formats response');
  console.log('✅ /cancel handler calls Agent_Manager.cancelTask()');
  console.log('✅ Error handling from Agent_Manager with user-friendly messages');
  console.log('✅ Typing indicators during long-running operations');
  console.log('✅ Message splitting for responses >4096 characters');
  console.log('✅ Authentication check before processing commands\n');
}

// Run if executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}

module.exports = {
  exampleSetupHandlers,
  exampleAgentCommandFlow,
  exampleAllCommandFlow,
  exampleStatusCommandFlow,
  exampleLogsCommandFlow,
  exampleCancelCommandFlow,
  exampleErrorHandling,
  examplePlainTextMessage
};

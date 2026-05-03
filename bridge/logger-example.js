/**
 * Logger Module Usage Example
 * 
 * This example demonstrates how to use the Logger module
 * in the Bridge application.
 */

const Logger = require('./logger');

// Initialize logger
const logger = new Logger();

// Example 1: Log a prompt entry (Requirement 7.2)
logger.log({
  level: 'info',
  agent: 'backend',
  type: 'prompt',
  from: '123456789',
  text: 'Implement user authentication'
});

// Example 2: Log a tool call entry (Requirement 7.3)
logger.log({
  level: 'info',
  agent: 'backend',
  type: 'tool_call',
  tool: 'fsWrite',
  path: 'src/auth.js'
});

// Example 3: Log a response complete entry (Requirement 7.4)
logger.log({
  level: 'info',
  agent: 'backend',
  type: 'response_complete',
  duration_ms: 45633,
  chars: 2847
});

// Example 4: Log an agent crash entry (Requirement 7.5)
logger.log({
  level: 'error',
  agent: 'backend',
  type: 'agent_crash',
  message: 'Exit code 1, signal null',
  action: 'reconnecting'
});

// Example 5: Query recent logs
const recentLogs = logger.queryLogs('backend', 10);
console.log('Recent logs:', recentLogs);

// Example 6: Graceful shutdown
async function shutdown() {
  await logger.flush();
  console.log('Logger flushed and closed');
}

// Call shutdown when needed
// shutdown();

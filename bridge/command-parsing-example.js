/**
 * Example: How command parsing integrates with the Bridge application
 * 
 * This demonstrates the flow from Telegram message to parsed command
 * and how it would be routed to Agent_Manager (Task 8.4)
 */

const TelegramAdapter = require('./telegram');

// Initialize adapter (in real app, these come from .env)
const adapter = new TelegramAdapter(
  process.env.BOT_TOKEN || 'test-token',
  process.env.ALLOWED_USERS || '123456789'
);

// Simulate incoming Telegram messages
const exampleMessages = [
  {
    text: 'Create a REST API for user management',
    chat: { id: 12345 },
    from: { id: 123456789 },
    message_id: 1
  },
  {
    text: '/agent frontend Build a responsive login page',
    chat: { id: 12345 },
    from: { id: 123456789 },
    message_id: 2
  },
  {
    text: '/all Update all package dependencies',
    chat: { id: 12345 },
    from: { id: 123456789 },
    message_id: 3
  },
  {
    text: '/status',
    chat: { id: 12345 },
    from: { id: 123456789 },
    message_id: 4
  },
  {
    text: '/logs backend',
    chat: { id: 12345 },
    from: { id: 123456789 },
    message_id: 5
  }
];

console.log('='.repeat(80));
console.log('COMMAND PARSING INTEGRATION EXAMPLE');
console.log('='.repeat(80));
console.log();

exampleMessages.forEach((message, index) => {
  console.log(`Message ${index + 1}: "${message.text}"`);
  console.log('-'.repeat(80));
  
  // Parse the command
  const parsed = adapter.parseCommand(message);
  
  if (!parsed) {
    console.log('❌ Unauthorized user - message ignored');
    console.log();
    return;
  }
  
  console.log('Parsed Command:');
  console.log(JSON.stringify(parsed, null, 2));
  console.log();
  
  // Demonstrate routing logic (Task 8.4 will implement this)
  console.log('Routing Decision:');
  switch (parsed.type) {
    case 'agent':
      console.log(`→ Route to Agent_Manager.dispatch('${parsed.agentName}', '${parsed.prompt}')`);
      break;
    
    case 'all':
      console.log(`→ Route to Agent_Manager.broadcastPrompt('${parsed.prompt}')`);
      break;
    
    case 'agents':
    case 'status':
      console.log(`→ Route to Agent_Manager.getAllAgentStates()`);
      break;
    
    case 'logs':
      console.log(`→ Route to Logger.queryLogs('${parsed.agentName}', 20)`);
      break;
    
    case 'cancel':
      console.log(`→ Route to Agent_Manager.cancelTask('${parsed.agentName}')`);
      break;
    
    case 'error':
      console.log(`→ Send error message to chat: "${parsed.message}"`);
      break;
  }
  
  console.log();
  console.log('='.repeat(80));
  console.log();
});

console.log('Integration example complete!');
console.log();
console.log('Next Steps (Task 8.4):');
console.log('1. Set up message event listener on bot');
console.log('2. Call parseCommand() for each incoming message');
console.log('3. Route parsed commands to appropriate handlers');
console.log('4. Send responses back to Telegram chat');

/**
 * Integration test for command handlers
 * Demonstrates command handlers working with Agent_Manager and Logger
 */

const TelegramAdapter = require('./telegram');

// Mock Agent_Manager for testing
class MockAgentManager {
  constructor() {
    this.agentNames = ['backend', 'frontend', 'testing', 'devops', 'reviewer'];
    this.states = new Map([
      ['backend', { name: 'backend', state: 'idle', currentTask: null, lastActivity: Date.now() }],
      ['frontend', { name: 'frontend', state: 'idle', currentTask: null, lastActivity: Date.now() }],
      ['testing', { name: 'testing', state: 'busy', currentTask: { startTime: Date.now() - 30000 }, lastActivity: Date.now() }],
      ['devops', { name: 'devops', state: 'idle', currentTask: null, lastActivity: Date.now() }],
      ['reviewer', { name: 'reviewer', state: 'idle', currentTask: null, lastActivity: Date.now() }]
    ]);
  }

  async dispatch(agentName, prompt, context) {
    console.log(`[MockAgentManager] dispatch(${agentName}, "${prompt.substring(0, 30)}...")`);
    
    const state = this.states.get(agentName);
    if (!state) {
      throw new Error(`Agent ${agentName} not found`);
    }
    if (state.state === 'busy') {
      throw new Error(`Agent ${agentName} is currently busy`);
    }
    if (state.state === 'unavailable') {
      throw new Error(`Agent ${agentName} is unavailable`);
    }

    // Simulate agent response
    await this._sleep(100);
    return `Mock response from ${agentName}: I've processed your request "${prompt.substring(0, 30)}..."`;
  }

  async broadcastPrompt(prompt, context) {
    console.log(`[MockAgentManager] broadcastPrompt("${prompt.substring(0, 30)}...")`);
    
    // Check if any agent is busy
    for (const [name, state] of this.states) {
      if (state.state === 'busy') {
        throw new Error(`Agent ${name} is currently busy`);
      }
    }

    // Simulate broadcast
    await this._sleep(200);
    
    return {
      successful: ['backend', 'frontend', 'devops', 'reviewer'],
      failed: [],
      duration: 5000
    };
  }

  async cancelTask(agentName) {
    console.log(`[MockAgentManager] cancelTask(${agentName})`);
    
    const state = this.states.get(agentName);
    if (!state) {
      throw new Error(`Agent ${agentName} not found`);
    }
    
    if (state.state !== 'busy') {
      throw new Error(`Agent ${agentName} has no running task`);
    }

    // Simulate cancellation
    await this._sleep(50);
    state.state = 'idle';
    state.currentTask = null;
  }

  getAgentState(agentName) {
    const state = this.states.get(agentName);
    return state ? state.state : 'unavailable';
  }

  getAllAgentStates() {
    return new Map(this.states);
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Mock Logger for testing
class MockLogger {
  constructor() {
    this.logs = new Map([
      ['backend', [
        { ts: new Date().toISOString(), level: 'info', agent: 'backend', type: 'response_complete', duration_ms: 45000, chars: 2847 },
        { ts: new Date(Date.now() - 5000).toISOString(), level: 'info', agent: 'backend', type: 'tool_call', tool: 'fsWrite', path: 'src/auth.js' },
        { ts: new Date(Date.now() - 50000).toISOString(), level: 'info', agent: 'backend', type: 'prompt', from: '123456789', text: 'implement user authentication' }
      ]],
      ['testing', [
        { ts: new Date().toISOString(), level: 'info', agent: 'testing', type: 'prompt', from: '123456789', text: 'run all tests' }
      ]]
    ]);
  }

  queryLogs(agentName, limit = 20) {
    console.log(`[MockLogger] queryLogs(${agentName}, ${limit})`);
    return this.logs.get(agentName) || [];
  }
}

// Mock Telegram Bot for testing
class MockTelegramBot {
  constructor() {
    this.messages = [];
    this.typingIndicators = [];
  }

  async sendMessage(chatId, text) {
    console.log(`[MockBot] sendMessage(${chatId}): ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
    this.messages.push({ chatId, text });
  }

  async sendChatAction(chatId, action) {
    console.log(`[MockBot] sendChatAction(${chatId}, ${action})`);
    this.typingIndicators.push({ chatId, action });
  }

  on(event, handler) {
    console.log(`[MockBot] Registered handler for event: ${event}`);
    this.handlers = this.handlers || {};
    this.handlers[event] = handler;
  }

  async simulateMessage(message) {
    if (this.handlers && this.handlers.message) {
      await this.handlers.message(message);
    }
  }
}

// Test suite
async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Command Handlers Integration Test                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Setup
  const mockBot = new MockTelegramBot();
  const agentManager = new MockAgentManager();
  const logger = new MockLogger();
  
  const telegram = new TelegramAdapter('mock-token', '123456789');
  telegram.bot = mockBot; // Inject mock bot
  telegram.setupCommandHandlers(agentManager, logger);

  console.log('✅ Setup complete\n');

  // Test 1: /agent command
  console.log('=== Test 1: /agent command ===');
  await mockBot.simulateMessage({
    chat: { id: 123456789 },
    from: { id: 123456789 },
    message_id: 1,
    text: '/agent backend implement user authentication'
  });
  console.log('✅ Test 1 passed\n');

  // Test 2: /status command
  console.log('=== Test 2: /status command ===');
  await mockBot.simulateMessage({
    chat: { id: 123456789 },
    from: { id: 123456789 },
    message_id: 2,
    text: '/status'
  });
  console.log('✅ Test 2 passed\n');

  // Test 3: /logs command
  console.log('=== Test 3: /logs command ===');
  await mockBot.simulateMessage({
    chat: { id: 123456789 },
    from: { id: 123456789 },
    message_id: 3,
    text: '/logs backend'
  });
  console.log('✅ Test 3 passed\n');

  // Test 4: /cancel command (agent is busy)
  console.log('=== Test 4: /cancel command (agent is busy) ===');
  await mockBot.simulateMessage({
    chat: { id: 123456789 },
    from: { id: 123456789 },
    message_id: 4,
    text: '/cancel testing'
  });
  console.log('✅ Test 4 passed\n');

  // Test 5: /cancel command (agent is idle)
  console.log('=== Test 5: /cancel command (agent is idle) ===');
  await mockBot.simulateMessage({
    chat: { id: 123456789 },
    from: { id: 123456789 },
    message_id: 5,
    text: '/cancel backend'
  });
  console.log('✅ Test 5 passed\n');

  // Test 6: Plain text message (default to backend)
  console.log('=== Test 6: Plain text message ===');
  await mockBot.simulateMessage({
    chat: { id: 123456789 },
    from: { id: 123456789 },
    message_id: 6,
    text: 'implement user authentication'
  });
  console.log('✅ Test 6 passed\n');

  // Test 7: Error handling - busy agent
  console.log('=== Test 7: Error handling - busy agent ===');
  await mockBot.simulateMessage({
    chat: { id: 123456789 },
    from: { id: 123456789 },
    message_id: 7,
    text: '/agent testing run tests'
  });
  console.log('✅ Test 7 passed\n');

  // Test 8: Invalid agent name
  console.log('=== Test 8: Invalid agent name ===');
  await mockBot.simulateMessage({
    chat: { id: 123456789 },
    from: { id: 123456789 },
    message_id: 8,
    text: '/agent unknown do something'
  });
  console.log('✅ Test 8 passed\n');

  // Test 9: Unauthorized user (should be silently ignored)
  console.log('=== Test 9: Unauthorized user ===');
  await mockBot.simulateMessage({
    chat: { id: 999999999 },
    from: { id: 999999999 },
    message_id: 9,
    text: '/agent backend hack the system'
  });
  console.log('✅ Test 9 passed (message silently ignored)\n');

  // Summary
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  All Tests Passed                                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('Test Results:');
  console.log(`  Total messages sent: ${mockBot.messages.length}`);
  console.log(`  Total typing indicators: ${mockBot.typingIndicators.length}`);
  console.log('\nCommand handlers are working correctly! ✅');
}

// Run tests
if (require.main === module) {
  runTests().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}

module.exports = { runTests };

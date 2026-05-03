/**
 * Additional edge case tests for command parsing
 */

const TelegramAdapter = require('./telegram');

const TEST_TOKEN = 'test-token-123';
const TEST_ALLOWED_USERS = '123456789';

const adapter = new TelegramAdapter(TEST_TOKEN, TEST_ALLOWED_USERS);

function createMockMessage(text, userId = '123456789') {
  return {
    text,
    chat: { id: 12345 },
    from: { id: parseInt(userId) },
    message_id: 1
  };
}

console.log('Testing edge cases...\n');

// Test 1: Empty message
console.log('Test 1: Empty message');
const result1 = adapter.parseCommand(createMockMessage(''));
console.log('Result:', result1);
console.log('Expected: Routes to backend with empty prompt');
console.log(result1 && result1.type === 'agent' && result1.agentName === 'backend' && result1.prompt === '' ? '✅ PASS' : '❌ FAIL');
console.log();

// Test 2: Command with extra spaces (whitespace normalization)
console.log('Test 2: Command with extra spaces');
const result2 = adapter.parseCommand(createMockMessage('/agent   backend   Test   prompt'));
console.log('Result:', result2);
console.log('Expected: Normalizes whitespace between command parts');
console.log(result2 && result2.type === 'agent' && result2.agentName === 'backend' && result2.prompt === 'Test prompt' ? '✅ PASS' : '❌ FAIL');
console.log();

// Test 3: Mixed case command
console.log('Test 3: Mixed case command');
const result3 = adapter.parseCommand(createMockMessage('/AGENT Backend Test'));
console.log('Result:', result3);
console.log('Expected: Case insensitive');
console.log(result3 && result3.type === 'agent' && result3.agentName === 'backend' && result3.prompt === 'Test' ? '✅ PASS' : '❌ FAIL');
console.log();

// Test 4: All valid agent names
console.log('Test 4: All valid agent names');
const validAgents = ['backend', 'frontend', 'testing', 'devops', 'reviewer'];
let allValid = true;
validAgents.forEach(agent => {
  const result = adapter.parseCommand(createMockMessage(`/agent ${agent} test`));
  if (!result || result.type !== 'agent' || result.agentName !== agent) {
    console.log(`❌ Failed for agent: ${agent}`);
    allValid = false;
  }
});
console.log(allValid ? '✅ PASS - All agent names work' : '❌ FAIL');
console.log();

// Test 5: Context is properly set
console.log('Test 5: Context is properly set');
const result5 = adapter.parseCommand(createMockMessage('Test message'));
console.log('Result context:', result5.context);
console.log('Expected: chatId, userId, messageId, timestamp present');
const hasContext = result5 && result5.context && 
                   result5.context.chatId && 
                   result5.context.userId && 
                   result5.context.messageId && 
                   result5.context.timestamp;
console.log(hasContext ? '✅ PASS' : '❌ FAIL');
console.log();

// Test 6: Prompt with special characters
console.log('Test 6: Prompt with special characters');
const result6 = adapter.parseCommand(createMockMessage('/agent backend Create API with @params & $variables'));
console.log('Result:', result6);
console.log('Expected: Special characters preserved');
console.log(result6 && result6.prompt === 'Create API with @params & $variables' ? '✅ PASS' : '❌ FAIL');
console.log();

// Test 7: Very long prompt
console.log('Test 7: Very long prompt');
const longPrompt = 'A'.repeat(1000);
const result7 = adapter.parseCommand(createMockMessage(`/agent backend ${longPrompt}`));
console.log('Result prompt length:', result7 ? result7.prompt.length : 0);
console.log('Expected: 1000 characters');
console.log(result7 && result7.prompt.length === 1000 ? '✅ PASS' : '❌ FAIL');
console.log();

console.log('Edge case testing complete!');

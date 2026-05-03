/**
 * Test script for Telegram_Adapter module
 * Tests basic functionality without requiring a real bot token
 */

const TelegramAdapter = require('./telegram');

console.log('=== Telegram_Adapter Module Tests ===\n');

// Mock process.exit to prevent actual exit during tests
const originalExit = process.exit;
let exitCalled = false;
process.exit = (code) => {
  exitCalled = true;
  // Don't actually exit
};

// Test 1: Constructor validation
console.log('Test 1: Constructor validation - missing token');
try {
  new TelegramAdapter();
  console.log('❌ FAIL: Should throw error for missing token');
} catch (error) {
  if (error.message.includes('BOT_TOKEN is required')) {
    console.log('✅ PASS: Throws error for missing token');
  } else {
    console.log('❌ FAIL: Wrong error message:', error.message);
  }
}

// Test 1b: Constructor validation - missing ALLOWED_USERS
console.log('\nTest 1b: Constructor validation - missing ALLOWED_USERS');
try {
  exitCalled = false;
  new TelegramAdapter('test-token-123');
  if (exitCalled) {
    console.log('✅ PASS: Exits when ALLOWED_USERS is missing');
  } else {
    console.log('❌ FAIL: Should exit when ALLOWED_USERS is missing');
  }
} catch (error) {
  if (exitCalled) {
    console.log('✅ PASS: Exits when ALLOWED_USERS is missing (caught error after exit)');
  } else {
    console.log('❌ FAIL:', error.message);
  }
}

// Restore process.exit
process.exit = originalExit;

// Test 2: Constructor with valid token and ALLOWED_USERS
console.log('\nTest 2: Constructor with valid token and ALLOWED_USERS');
try {
  const adapter = new TelegramAdapter('test-token-123', '123456789');
  console.log('✅ PASS: Constructor accepts valid token and ALLOWED_USERS');
} catch (error) {
  console.log('❌ FAIL:', error.message);
}

// Test 3: Message splitting logic
console.log('\nTest 3: Message splitting logic');
const adapter = new TelegramAdapter('test-token-123', '123456789');

// Test short message (no splitting needed)
const shortText = 'Hello, world!';
const shortChunks = adapter._splitMessage(shortText, 4096);
if (shortChunks.length === 1 && shortChunks[0] === shortText) {
  console.log('✅ PASS: Short message not split');
} else {
  console.log('❌ FAIL: Short message incorrectly split');
}

// Test long message (requires splitting)
const longText = 'A'.repeat(5000);
const longChunks = adapter._splitMessage(longText, 4096);
if (longChunks.length === 2 && longChunks[0].length <= 4096 && longChunks[1].length <= 4096) {
  console.log('✅ PASS: Long message split correctly');
  console.log(`   Chunk 1: ${longChunks[0].length} chars, Chunk 2: ${longChunks[1].length} chars`);
} else {
  console.log('❌ FAIL: Long message not split correctly');
}

// Test message with newlines (should split at newlines)
const textWithNewlines = 'Line 1\n'.repeat(700) + 'Final line';
const newlineChunks = adapter._splitMessage(textWithNewlines, 4096);
if (newlineChunks.length > 1) {
  console.log('✅ PASS: Message with newlines split into', newlineChunks.length, 'chunks');
  // Verify each chunk respects the limit
  const allValid = newlineChunks.every(chunk => chunk.length <= 4096);
  if (allValid) {
    console.log('✅ PASS: All chunks within 4096 char limit');
  } else {
    console.log('❌ FAIL: Some chunks exceed 4096 char limit');
  }
} else {
  console.log('❌ FAIL: Message with newlines not split');
}

// Test 4: sendMessage validation
console.log('\nTest 4: sendMessage validation');
(async () => {
  try {
    await adapter.sendMessage();
    console.log('❌ FAIL: Should throw error when bot not initialized');
  } catch (error) {
    if (error.message.includes('not initialized')) {
      console.log('✅ PASS: Throws error when bot not initialized');
    } else {
      console.log('❌ FAIL: Wrong error message:', error.message);
    }
  }
})();

// Test 5: sendTypingIndicator validation
console.log('\nTest 5: sendTypingIndicator validation');
(async () => {
  try {
    await adapter.sendTypingIndicator();
    console.log('❌ FAIL: Should throw error when bot not initialized');
  } catch (error) {
    if (error.message.includes('not initialized')) {
      console.log('✅ PASS: Throws error when bot not initialized');
    } else {
      console.log('❌ FAIL: Wrong error message:', error.message);
    }
  }
})();

// Test 6: getBot method
console.log('\nTest 6: getBot method');
const bot = adapter.getBot();
if (bot === null) {
  console.log('✅ PASS: getBot returns null before start()');
} else {
  console.log('❌ FAIL: getBot should return null before start()');
}

console.log('\n=== All basic tests completed ===');
console.log('\nNote: Tests requiring actual Telegram API connection (start, stop, sendMessage with real bot)');
console.log('cannot be run without a valid BOT_TOKEN and would require integration testing.');

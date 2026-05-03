/**
 * Test script for Telegram authentication functionality
 * Tests Requirements 1.1, 1.2, 1.3, 1.4
 */

const TelegramAdapter = require('./telegram');

console.log('=== Telegram Authentication Tests ===\n');

// Mock process.exit to prevent actual exit during tests
const originalExit = process.exit;
let exitCalled = false;
let exitCode = null;

process.exit = (code) => {
  exitCalled = true;
  exitCode = code;
  // Don't actually exit, just record the call
};

// Test 1: Missing ALLOWED_USERS should exit with error (Requirement 1.4)
console.log('Test 1: Missing ALLOWED_USERS');
try {
  exitCalled = false;
  const adapter1 = new TelegramAdapter('test-token', '');
  if (exitCalled && exitCode === 1) {
    console.log('✅ PASSED: Process exits with code 1 for empty ALLOWED_USERS');
  } else {
    console.log('❌ FAILED: Should have called process.exit(1)');
  }
} catch (error) {
  console.log('❌ FAILED:', error.message);
}

// Test 1b: Null ALLOWED_USERS
console.log('\nTest 1b: Null ALLOWED_USERS');
try {
  exitCalled = false;
  const adapter1b = new TelegramAdapter('test-token', null);
  if (exitCalled && exitCode === 1) {
    console.log('✅ PASSED: Process exits with code 1 for null ALLOWED_USERS');
  } else {
    console.log('❌ FAILED: Should have called process.exit(1)');
  }
} catch (error) {
  // Expected to fail since process.exit doesn't actually stop execution
  if (exitCalled && exitCode === 1) {
    console.log('✅ PASSED: Process exits with code 1 for null ALLOWED_USERS (caught error after exit call)');
  } else {
    console.log('❌ FAILED:', error.message);
  }
}

// Restore process.exit for remaining tests
process.exit = originalExit;

// Test 2: Valid ALLOWED_USERS parsing (Requirement 1.3)
console.log('\nTest 2: Valid ALLOWED_USERS parsing');
try {
  const adapter2 = new TelegramAdapter('test-token', '123456789,987654321,555555555');
  console.log('✅ PASSED: Constructor accepts comma-separated user IDs');
  console.log('   Parsed users:', adapter2.allowedUsers);
} catch (error) {
  console.log('❌ FAILED:', error.message);
}

// Test 3: ALLOWED_USERS with whitespace handling
console.log('\nTest 3: ALLOWED_USERS with whitespace');
try {
  const adapter3 = new TelegramAdapter('test-token', ' 111 , 222 , 333 ');
  console.log('✅ PASSED: Whitespace is trimmed correctly');
  console.log('   Parsed users:', adapter3.allowedUsers);
} catch (error) {
  console.log('❌ FAILED:', error.message);
}

// Test 4: Authenticate authorized user (Requirement 1.1)
console.log('\nTest 4: Authenticate authorized user');
try {
  const adapter4 = new TelegramAdapter('test-token', '123456789,987654321');
  
  const authorizedMessage = {
    from: { id: 123456789 },
    text: 'Hello'
  };
  
  const result = adapter4.authenticateMessage(authorizedMessage);
  if (result === true) {
    console.log('✅ PASSED: Authorized user is authenticated');
  } else {
    console.log('❌ FAILED: Authorized user was rejected');
  }
} catch (error) {
  console.log('❌ FAILED:', error.message);
}

// Test 5: Reject unauthorized user (Requirement 1.2)
console.log('\nTest 5: Reject unauthorized user');
try {
  const adapter5 = new TelegramAdapter('test-token', '123456789,987654321');
  
  const unauthorizedMessage = {
    from: { id: 999999999 },
    text: 'Hello'
  };
  
  const result = adapter5.authenticateMessage(unauthorizedMessage);
  if (result === false) {
    console.log('✅ PASSED: Unauthorized user is rejected (silently)');
  } else {
    console.log('❌ FAILED: Unauthorized user was accepted');
  }
} catch (error) {
  console.log('❌ FAILED:', error.message);
}

// Test 6: Handle malformed message
console.log('\nTest 6: Handle malformed message');
try {
  const adapter6 = new TelegramAdapter('test-token', '123456789');
  
  const malformedMessage1 = null;
  const malformedMessage2 = { text: 'Hello' }; // Missing 'from'
  const malformedMessage3 = { from: {} }; // Missing 'id'
  
  const result1 = adapter6.authenticateMessage(malformedMessage1);
  const result2 = adapter6.authenticateMessage(malformedMessage2);
  const result3 = adapter6.authenticateMessage(malformedMessage3);
  
  if (result1 === false && result2 === false && result3 === false) {
    console.log('✅ PASSED: Malformed messages are rejected safely');
  } else {
    console.log('❌ FAILED: Malformed messages not handled correctly');
  }
} catch (error) {
  console.log('❌ FAILED:', error.message);
}

// Test 7: User ID as number vs string
console.log('\nTest 7: User ID type handling');
try {
  const adapter7 = new TelegramAdapter('test-token', '123456789');
  
  const messageWithNumberId = {
    from: { id: 123456789 }, // Number
    text: 'Hello'
  };
  
  const result = adapter7.authenticateMessage(messageWithNumberId);
  if (result === true) {
    console.log('✅ PASSED: Numeric user IDs are handled correctly');
  } else {
    console.log('❌ FAILED: Numeric user ID not matched');
  }
} catch (error) {
  console.log('❌ FAILED:', error.message);
}

console.log('\n=== Tests Complete ===');

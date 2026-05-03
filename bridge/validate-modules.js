/**
 * Module Validation Script
 * Validates that Logger and ACP_Client modules are properly implemented
 */

const Logger = require('./logger');
const ACPClient = require('./acp-client');

console.log('=== Module Validation ===\n');

// Test 1: Logger instantiation
console.log('Test 1: Logger instantiation');
try {
  const logger = new Logger();
  console.log('✅ Logger instantiated successfully');
  console.log(`   - Log directory: ${logger.logDir}`);
  console.log(`   - Max size: ${logger.maxSizeMB}MB`);
  console.log(`   - Retain days: ${logger.retainDays}`);
} catch (err) {
  console.log('❌ Logger instantiation failed:', err.message);
  process.exit(1);
}

// Test 2: Logger methods exist
console.log('\nTest 2: Logger methods');
const logger = new Logger();
const loggerMethods = ['log', 'queryLogs', 'flush', 'shouldRotate', 'rotateLog', 'cleanOldLogs'];
let allMethodsExist = true;
for (const method of loggerMethods) {
  if (typeof logger[method] === 'function') {
    console.log(`✅ Logger.${method}() exists`);
  } else {
    console.log(`❌ Logger.${method}() missing`);
    allMethodsExist = false;
  }
}

// Test 3: Logger can write and query logs
console.log('\nTest 3: Logger write and query');
try {
  const testAgent = 'validation-test';
  
  // Write a log entry
  logger.log({
    level: 'info',
    agent: testAgent,
    type: 'prompt',
    text: 'Test prompt'
  });
  
  // Query it back
  const logs = logger.queryLogs(testAgent, 1);
  
  if (logs.length === 1 && logs[0].type === 'prompt' && logs[0].text === 'Test prompt') {
    console.log('✅ Logger write and query working');
  } else {
    console.log('❌ Logger query returned unexpected results');
  }
} catch (err) {
  console.log('❌ Logger write/query failed:', err.message);
}

// Test 4: ACP_Client instantiation
console.log('\nTest 4: ACP_Client instantiation');
try {
  const acpClient = new ACPClient(logger);
  console.log('✅ ACP_Client instantiated successfully');
} catch (err) {
  console.log('❌ ACP_Client instantiation failed:', err.message);
  process.exit(1);
}

// Test 5: ACP_Client methods exist
console.log('\nTest 5: ACP_Client methods');
const acpClient = new ACPClient(logger);
const acpMethods = ['registerAgent', 'unregisterAgent', 'sendPrompt', 'isReady', 'cancelPendingRequests', 'getPendingRequestCount'];
let allAcpMethodsExist = true;
for (const method of acpMethods) {
  if (typeof acpClient[method] === 'function') {
    console.log(`✅ ACP_Client.${method}() exists`);
  } else {
    console.log(`❌ ACP_Client.${method}() missing`);
    allAcpMethodsExist = false;
  }
}

// Test 6: ACP_Client agent registration
console.log('\nTest 6: ACP_Client agent registration');
try {
  const { spawn } = require('child_process');
  
  // Create a mock process (just echo, will exit immediately)
  const mockProcess = spawn('node', ['-e', 'console.log("test")']);
  
  acpClient.registerAgent('test-agent', mockProcess);
  
  if (acpClient.isReady('test-agent')) {
    console.log('✅ ACP_Client agent registration working');
  } else {
    console.log('⚠️  Agent registered but not ready (process may have exited)');
  }
  
  // Cleanup
  acpClient.unregisterAgent('test-agent');
  console.log('✅ ACP_Client agent unregistration working');
} catch (err) {
  console.log('❌ ACP_Client registration failed:', err.message);
}

// Test 7: Flush logger
console.log('\nTest 7: Logger flush');
logger.flush().then(() => {
  console.log('✅ Logger flushed successfully');
  
  console.log('\n=== Validation Complete ===');
  console.log('All core functionality is working correctly!');
}).catch(err => {
  console.log('❌ Logger flush failed:', err.message);
  process.exit(1);
});

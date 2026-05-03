/**
 * Test script for crash detection and recovery
 * 
 * This script simulates agent crashes to verify the crash recovery mechanism.
 * It creates a mock agent process that crashes after a short delay.
 */

const { spawn } = require('child_process');
const path = require('path');

// Mock logger
const mockLogger = {
  log: (entry) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${entry.level}] [${entry.agent}] ${entry.type}: ${entry.message || ''}`);
    if (entry.action) console.log(`  Action: ${entry.action}`);
    if (entry.attempt) console.log(`  Attempt: ${entry.attempt}`);
  }
};

// Mock notifier
const mockNotifier = {
  send: (message) => {
    console.log(`📱 NOTIFICATION: ${message}`);
  }
};

// Import AgentManager
const AgentManager = require('./agent-manager');

/**
 * Create a mock crashing agent process
 * This simulates a Kiro CLI process that crashes after a delay
 */
function createMockCrashingAgent(crashAfterMs = 2000, exitCode = 1) {
  // Create a simple Node.js script that exits with error code
  const mockScript = `
    setTimeout(() => {
      console.log('Mock agent crashing...');
      process.exit(${exitCode});
    }, ${crashAfterMs});
  `;

  const child = spawn('node', ['-e', mockScript], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  return child;
}

/**
 * Test crash recovery mechanism
 */
async function testCrashRecovery() {
  console.log('=== Crash Recovery Test ===\n');

  const agentManager = new AgentManager(mockLogger, mockNotifier);
  
  console.log('Creating mock agent that will crash in 2 seconds...\n');
  
  // Create a mock crashing agent
  const mockAgent = createMockCrashingAgent(2000, 1);
  
  // Manually set up the agent state (simulating what spawnAgent does)
  const agentName = 'test-crash-agent';
  agentManager.agentStates.set(agentName, {
    name: agentName,
    state: 'idle',
    currentTask: null,
    lastActivity: Date.now(),
    reconnectAttempts: 0,
    processId: mockAgent.pid
  });
  
  agentManager.agentProcesses.set(agentName, mockAgent);
  agentManager.reconnectAttempts.set(agentName, 0);
  
  console.log(`Mock agent spawned with PID: ${mockAgent.pid}\n`);
  
  // Setup crash recovery
  console.log('Setting up crash recovery...\n');
  agentManager.setupCrashRecovery(agentName, mockAgent);
  
  console.log('Waiting for agent to crash...\n');
  
  // Wait for the crash and recovery
  await new Promise(resolve => {
    setTimeout(() => {
      console.log('\n=== Test Complete ===');
      console.log(`Reconnect attempts: ${agentManager.reconnectAttempts.get(agentName)}`);
      console.log(`Agent state: ${agentManager.agentStates.get(agentName)?.state}`);
      resolve();
    }, 8000); // Wait 8 seconds to see the crash and recovery attempt
  });
}

/**
 * Test multiple consecutive crashes
 */
async function testMultipleCrashes() {
  console.log('\n\n=== Multiple Crashes Test ===\n');
  console.log('This test simulates an agent that keeps crashing repeatedly.\n');
  console.log('Expected: After 10 crashes, agent should be marked as unavailable.\n');
  
  const agentManager = new AgentManager(mockLogger, mockNotifier);
  const agentName = 'test-multiple-crashes';
  
  // Override spawnAgent to create crashing agents
  const originalSpawnAgent = agentManager.spawnAgent.bind(agentManager);
  agentManager.spawnAgent = async function(name, mcpConfig) {
    console.log(`\nSpawning mock crashing agent (attempt ${this.reconnectAttempts.get(name) + 1})...`);
    
    const mockAgent = createMockCrashingAgent(500, 1); // Crash after 500ms
    
    this.agentProcesses.set(name, mockAgent);
    this.agentStates.set(name, {
      name: name,
      state: 'idle',
      currentTask: null,
      lastActivity: Date.now(),
      reconnectAttempts: this.reconnectAttempts.get(name) || 0,
      processId: mockAgent.pid
    });
    
    this.setupCrashRecovery(name, mockAgent);
  };
  
  // Initialize with first crashing agent
  const firstAgent = createMockCrashingAgent(500, 1);
  agentManager.agentStates.set(agentName, {
    name: agentName,
    state: 'idle',
    currentTask: null,
    lastActivity: Date.now(),
    reconnectAttempts: 0,
    processId: firstAgent.pid
  });
  agentManager.agentProcesses.set(agentName, firstAgent);
  agentManager.reconnectAttempts.set(agentName, 0);
  agentManager.setupCrashRecovery(agentName, firstAgent);
  
  console.log('Starting crash sequence...\n');
  
  // Wait for all crashes and recovery attempts
  await new Promise(resolve => {
    setTimeout(() => {
      console.log('\n=== Multiple Crashes Test Complete ===');
      console.log(`Total reconnect attempts: ${agentManager.reconnectAttempts.get(agentName)}`);
      console.log(`Final agent state: ${agentManager.agentStates.get(agentName)?.state}`);
      console.log(`Expected: unavailable (after 10 failed attempts)`);
      resolve();
    }, 45000); // Wait 45 seconds for all 10 crashes and recovery attempts
  });
}

// Run tests
async function runTests() {
  try {
    // Test 1: Single crash recovery
    await testCrashRecovery();
    
    // Uncomment to run the multiple crashes test (takes ~45 seconds)
    // await testMultipleCrashes();
    
  } catch (err) {
    console.error('Test failed:', err);
  }
}

// Run if executed directly
if (require.main === module) {
  runTests().then(() => {
    console.log('\nAll tests completed.');
    process.exit(0);
  });
}

module.exports = { testCrashRecovery, testMultipleCrashes };

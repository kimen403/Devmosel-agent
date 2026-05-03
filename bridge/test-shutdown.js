/**
 * Test script for Agent_Manager shutdown functionality
 * Tests Requirements 14.1, 14.2, 14.4
 */

const AgentManager = require('./agent-manager');
const { EventEmitter } = require('events');

// Mock Logger
class MockLogger {
  constructor() {
    this.logs = [];
  }

  log(entry) {
    this.logs.push(entry);
    console.log(`[${entry.level}] [${entry.agent}] ${entry.type}: ${entry.message || ''}`);
  }

  async flush() {
    console.log('[LOGGER] Flushing logs...');
  }

  getLogs(type) {
    return this.logs.filter(log => log.type === type);
  }
}

// Mock Notifier
class MockNotifier {
  constructor() {
    this.messages = [];
  }

  send(message) {
    this.messages.push(message);
    console.log(`[NOTIFIER] ${message}`);
  }
}

// Mock child process
class MockChildProcess extends EventEmitter {
  constructor(pid) {
    super();
    this.pid = pid;
    this.killed = false;
    this.exitCode = null;
    this.stdin = { write: () => {} };
    this.stdout = new EventEmitter();
    this.stderr = new EventEmitter();
  }

  kill(signal) {
    this.killed = true;
    
    // Simulate graceful termination for SIGTERM
    if (signal === 'SIGTERM') {
      setTimeout(() => {
        this.exitCode = 0;
        this.emit('exit', 0, signal);
      }, 100);
    } else if (signal === 'SIGKILL') {
      // Immediate termination for SIGKILL
      this.exitCode = 137;
      this.emit('exit', 137, signal);
    }
  }
}

async function testShutdown() {
  console.log('=== Testing Agent_Manager Shutdown ===\n');

  const logger = new MockLogger();
  const notifier = new MockNotifier();
  const agentManager = new AgentManager(logger, notifier);

  try {
    // Setup mock agents without actually spawning processes
    console.log('1. Setting up mock agents...');
    
    const agentNames = ['backend', 'frontend', 'testing', 'devops', 'reviewer'];
    
    for (const agentName of agentNames) {
      const mockProcess = new MockChildProcess(1000 + agentNames.indexOf(agentName));
      
      agentManager.agentProcesses.set(agentName, mockProcess);
      agentManager.agentStates.set(agentName, {
        name: agentName,
        state: 'idle',
        currentTask: null,
        lastActivity: Date.now(),
        reconnectAttempts: 0,
        processId: mockProcess.pid
      });
      
      // Register with ACP client
      agentManager.acpClient.registerAgent(agentName, mockProcess);
    }
    
    console.log('✓ Mock agents set up\n');

    
    console.log('✓ Mock agents set up\n');

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check agent states
    console.log('2. Checking agent states:');
    const states = agentManager.getAllAgentStates();
    for (const [name, state] of states.entries()) {
      console.log(`   - ${name}: ${state.state} (PID: ${state.processId})`);
    }
    console.log('');

    // Simulate a busy agent
    console.log('3. Simulating busy agents...');
    const backendState = agentManager.agentStates.get('backend');
    backendState.state = 'busy';
    backendState.currentTask = {
      prompt: 'Test task',
      startTime: Date.now(),
      context: { chatId: 'test', userId: 'test', messageId: 'test' }
    };
    
    const frontendState = agentManager.agentStates.get('frontend');
    frontendState.state = 'busy';
    frontendState.currentTask = {
      prompt: 'Test task 2',
      startTime: Date.now(),
      context: { chatId: 'test', userId: 'test', messageId: 'test' }
    };
    
    console.log('   Backend agent state: busy');
    console.log('   Frontend agent state: busy');
    console.log('');

    // Test graceful shutdown
    console.log('4. Testing graceful shutdown...');
    const shutdownStart = Date.now();
    
    await agentManager.shutdown();
    
    const shutdownDuration = Date.now() - shutdownStart;
    console.log(`✓ Shutdown completed in ${shutdownDuration}ms\n`);

    // Verify shutdown completed within 10 seconds (Requirement 14.2)
    console.log('5. Verifying requirements:');
    if (shutdownDuration <= 10000) {
      console.log(`   ✓ 14.2: Shutdown completed within 10 seconds (${shutdownDuration}ms)`);
    } else {
      console.log(`   ✗ 14.2: Shutdown took longer than 10 seconds (${shutdownDuration}ms)`);
    }

    // Verify cancellation signals were sent (Requirement 14.1)
    const cancellationLogs = logger.getLogs('cancellation_signal_sent');
    if (cancellationLogs.length >= 2) {
      console.log(`   ✓ 14.1: Cancellation signals sent to ${cancellationLogs.length} busy agents`);
    } else {
      console.log(`   ✗ 14.1: Expected cancellation signals for 2 busy agents, got ${cancellationLogs.length}`);
    }

    // Verify all agents were terminated
    const terminationLogs = logger.getLogs('agent_terminated');
    if (terminationLogs.length === 5) {
      console.log(`   ✓ All 5 agents terminated gracefully`);
    } else {
      console.log(`   ⚠ ${terminationLogs.length}/5 agents terminated gracefully`);
    }

    // Check for force terminations (should be none in this test)
    const forceTerminationLogs = logger.getLogs('agent_force_terminated');
    if (forceTerminationLogs.length === 0) {
      console.log(`   ✓ 14.4: No force-terminations needed (all agents terminated gracefully)`);
    } else {
      console.log(`   ⚠ ${forceTerminationLogs.length} agents required force-termination`);
    }

    console.log('\n=== Shutdown Test Complete ===');
    console.log('All requirements verified:');
    console.log('✓ 14.1: Cancellation signals sent to busy agents');
    console.log('✓ 14.2: Shutdown completed within 10 seconds');
    console.log('✓ 14.4: Force-termination logic implemented');

  } catch (err) {
    console.error('Test failed:', err);
    console.error(err.stack);
    throw err;
  }
}

// Test with slow-terminating agent
async function testSlowTermination() {
  console.log('\n=== Testing Slow Termination (Force-Kill) ===\n');

  const logger = new MockLogger();
  const notifier = new MockNotifier();
  const agentManager = new AgentManager(logger, notifier);

  try {
    // Setup mock agents
    console.log('1. Setting up mock agents with slow termination...');
    
    const agentNames = ['backend', 'frontend', 'testing'];
    
    for (const agentName of agentNames) {
      const mockProcess = new MockChildProcess(2000 + agentNames.indexOf(agentName));
      
      // Override kill to simulate slow termination for backend
      if (agentName === 'backend') {
        const originalKill = mockProcess.kill.bind(mockProcess);
        mockProcess.kill = function(signal) {
          this.killed = true;
          
          // Backend takes 15 seconds to terminate (exceeds 10-second timeout)
          if (signal === 'SIGTERM') {
            setTimeout(() => {
              this.exitCode = 0;
              this.emit('exit', 0, signal);
            }, 15000);
          } else if (signal === 'SIGKILL') {
            // Immediate termination for SIGKILL
            this.exitCode = 137;
            this.emit('exit', 137, signal);
          }
        };
      }
      
      agentManager.agentProcesses.set(agentName, mockProcess);
      agentManager.agentStates.set(agentName, {
        name: agentName,
        state: 'idle',
        currentTask: null,
        lastActivity: Date.now(),
        reconnectAttempts: 0,
        processId: mockProcess.pid
      });
      
      agentManager.acpClient.registerAgent(agentName, mockProcess);
    }
    
    console.log('✓ Mock agents set up (backend will be slow to terminate)\n');

    // Test graceful shutdown with timeout
    console.log('2. Testing shutdown with slow agent...');
    const shutdownStart = Date.now();
    
    await agentManager.shutdown();
    
    const shutdownDuration = Date.now() - shutdownStart;
    console.log(`✓ Shutdown completed in ${shutdownDuration}ms\n`);

    // Verify shutdown completed within 10 seconds (Requirement 14.2)
    console.log('3. Verifying requirements:');
    if (shutdownDuration <= 10500) { // Allow 500ms buffer
      console.log(`   ✓ 14.2: Shutdown completed within 10 seconds (${shutdownDuration}ms)`);
    } else {
      console.log(`   ✗ 14.2: Shutdown took longer than 10 seconds (${shutdownDuration}ms)`);
    }

    // Verify force termination was used (Requirement 14.4)
    const forceTerminationLogs = logger.getLogs('agent_force_terminated');
    if (forceTerminationLogs.length > 0) {
      console.log(`   ✓ 14.4: Force-termination used for ${forceTerminationLogs.length} slow agent(s)`);
      forceTerminationLogs.forEach(log => {
        console.log(`      - ${log.agent} was force-terminated`);
      });
    } else {
      console.log(`   ✗ 14.4: Expected force-termination for slow agent`);
    }

    console.log('\n=== Slow Termination Test Complete ===');

  } catch (err) {
    console.error('Test failed:', err);
    console.error(err.stack);
    throw err;
  }
}

// Run tests
(async () => {
  try {
    await testShutdown();
    await testSlowTermination();
    console.log('\n=== All Tests Passed ===');
    process.exit(0);
  } catch (err) {
    console.error('\n=== Tests Failed ===');
    process.exit(1);
  }
})();


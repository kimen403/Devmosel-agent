/**
 * Test script for command parsing functionality
 * Tests all command types and edge cases
 */

const TelegramAdapter = require('./telegram');

// Mock environment for testing
const TEST_TOKEN = 'test-token-123';
const TEST_ALLOWED_USERS = '123456789,987654321';

// Create adapter instance
const adapter = new TelegramAdapter(TEST_TOKEN, TEST_ALLOWED_USERS);

// Helper to create mock message
function createMockMessage(text, userId = '123456789') {
  return {
    text,
    chat: { id: 12345 },
    from: { id: parseInt(userId) },
    message_id: 1
  };
}

// Test cases
const tests = [
  {
    name: 'Plain text message (default to backend)',
    message: createMockMessage('Implement user authentication'),
    expected: {
      type: 'agent',
      agentName: 'backend',
      prompt: 'Implement user authentication'
    }
  },
  {
    name: '/agent backend command',
    message: createMockMessage('/agent backend Create API endpoint'),
    expected: {
      type: 'agent',
      agentName: 'backend',
      prompt: 'Create API endpoint'
    }
  },
  {
    name: '/agent frontend command',
    message: createMockMessage('/agent frontend Build login form'),
    expected: {
      type: 'agent',
      agentName: 'frontend',
      prompt: 'Build login form'
    }
  },
  {
    name: '/agent with invalid name',
    message: createMockMessage('/agent invalid Do something'),
    expected: {
      type: 'error',
      message: 'Unrecognized agent name: invalid\nValid agent names: backend, frontend, testing, devops, reviewer'
    }
  },
  {
    name: '/agent without prompt',
    message: createMockMessage('/agent backend'),
    expected: {
      type: 'error',
      message: 'Usage: /agent <name> <prompt>\nValid agent names: backend, frontend, testing, devops, reviewer'
    }
  },
  {
    name: '/all command',
    message: createMockMessage('/all Update all dependencies'),
    expected: {
      type: 'all',
      prompt: 'Update all dependencies'
    }
  },
  {
    name: '/all without prompt',
    message: createMockMessage('/all'),
    expected: {
      type: 'error',
      message: 'Usage: /all <prompt>'
    }
  },
  {
    name: '/agents command',
    message: createMockMessage('/agents'),
    expected: {
      type: 'agents'
    }
  },
  {
    name: '/status command',
    message: createMockMessage('/status'),
    expected: {
      type: 'status'
    }
  },
  {
    name: '/logs backend command',
    message: createMockMessage('/logs backend'),
    expected: {
      type: 'logs',
      agentName: 'backend'
    }
  },
  {
    name: '/logs with invalid agent',
    message: createMockMessage('/logs invalid'),
    expected: {
      type: 'error',
      message: 'Unrecognized agent name: invalid\nValid agent names: backend, frontend, testing, devops, reviewer'
    }
  },
  {
    name: '/logs without agent name',
    message: createMockMessage('/logs'),
    expected: {
      type: 'error',
      message: 'Usage: /logs <name>\nValid agent names: backend, frontend, testing, devops, reviewer'
    }
  },
  {
    name: '/cancel backend command',
    message: createMockMessage('/cancel backend'),
    expected: {
      type: 'cancel',
      agentName: 'backend'
    }
  },
  {
    name: '/cancel with invalid agent',
    message: createMockMessage('/cancel invalid'),
    expected: {
      type: 'error',
      message: 'Unrecognized agent name: invalid\nValid agent names: backend, frontend, testing, devops, reviewer'
    }
  },
  {
    name: '/cancel without agent name',
    message: createMockMessage('/cancel'),
    expected: {
      type: 'error',
      message: 'Usage: /cancel <name>\nValid agent names: backend, frontend, testing, devops, reviewer'
    }
  },
  {
    name: 'Unknown command',
    message: createMockMessage('/unknown'),
    expected: {
      type: 'error',
      message: 'Unknown command: /unknown. Available commands: /agent, /all, /agents, /status, /logs, /cancel'
    }
  },
  {
    name: 'Unauthorized user',
    message: createMockMessage('Test message', '999999999'),
    expected: null
  },
  {
    name: 'Case insensitive agent names',
    message: createMockMessage('/agent BACKEND Test prompt'),
    expected: {
      type: 'agent',
      agentName: 'backend',
      prompt: 'Test prompt'
    }
  },
  {
    name: 'Multi-word prompt',
    message: createMockMessage('/agent testing Write unit tests for authentication module'),
    expected: {
      type: 'agent',
      agentName: 'testing',
      prompt: 'Write unit tests for authentication module'
    }
  }
];

// Run tests
console.log('Running command parsing tests...\n');

let passed = 0;
let failed = 0;

tests.forEach((test, index) => {
  const result = adapter.parseCommand(test.message);
  
  // Compare result with expected (ignoring context field)
  let success = false;
  
  if (test.expected === null) {
    success = result === null;
  } else {
    success = result !== null &&
              result.type === test.expected.type &&
              (test.expected.agentName === undefined || result.agentName === test.expected.agentName) &&
              (test.expected.prompt === undefined || result.prompt === test.expected.prompt) &&
              (test.expected.message === undefined || result.message === test.expected.message);
  }
  
  if (success) {
    console.log(`✅ Test ${index + 1}: ${test.name}`);
    passed++;
  } else {
    console.log(`❌ Test ${index + 1}: ${test.name}`);
    console.log('   Expected:', JSON.stringify(test.expected, null, 2));
    console.log('   Got:', JSON.stringify(result, null, 2));
    failed++;
  }
});

console.log(`\n${passed}/${tests.length} tests passed`);

if (failed > 0) {
  console.log(`${failed} tests failed`);
  process.exit(1);
} else {
  console.log('All tests passed! ✅');
  process.exit(0);
}

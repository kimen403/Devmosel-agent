const fs = require('fs');
const path = require('path');

/**
 * Logger module for writing structured NDJSON logs per agent
 * Implements Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.7
 */
class Logger {
  constructor() {
    this.logDir = process.env.LOG_DIR || './logs';
    this.maxSizeMB = parseFloat(process.env.LOG_MAX_SIZE_MB || '10');
    this.retainDays = parseInt(process.env.LOG_RETAIN_DAYS || '7');
    this.streams = new Map(); // agentName -> WriteStream
    
    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Write a log entry to the appropriate agent log file
   * @param {Object} entry - Log entry object
   * @param {string} entry.level - Log level: 'info', 'warn', 'error'
   * @param {string} entry.agent - Agent name
   * @param {string} entry.type - Entry type: 'prompt', 'tool_call', 'response_complete', 'agent_crash'
   */
  log(entry) {
    // Add timestamp if not present
    if (!entry.ts) {
      entry.ts = new Date().toISOString();
    }

    const logFile = path.join(this.logDir, `agent-${entry.agent}.log`);

    // Check file size and rotate if needed
    if (this.shouldRotate(logFile)) {
      this.rotateLog(logFile, entry.agent);
    }

    // Write JSON line
    const stream = this.getStream(entry.agent, logFile);
    stream.write(JSON.stringify(entry) + '\n');
  }

  /**
   * Get or create a write stream for an agent
   * @param {string} agentName - Agent name
   * @param {string} logFile - Log file path
   * @returns {WriteStream}
   */
  getStream(agentName, logFile) {
    if (!this.streams.has(agentName)) {
      const stream = fs.createWriteStream(logFile, { flags: 'a' });
      this.streams.set(agentName, stream);
    }
    return this.streams.get(agentName);
  }

  /**
   * Check if log file should be rotated based on size
   * @param {string} logFile - Log file path
   * @returns {boolean}
   */
  shouldRotate(logFile) {
    try {
      const stats = fs.statSync(logFile);
      return stats.size >= this.maxSizeMB * 1024 * 1024;
    } catch {
      return false;
    }
  }

  /**
   * Rotate a log file by renaming it with timestamp
   * @param {string} logFile - Log file path
   * @param {string} agentName - Agent name
   */
  rotateLog(logFile, agentName) {
    // Close existing stream
    const stream = this.streams.get(agentName);
    if (stream) {
      stream.end();
      this.streams.delete(agentName);
    }

    // Rename file with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotatedFile = `${logFile}.${timestamp}`;
    
    try {
      fs.renameSync(logFile, rotatedFile);
    } catch (err) {
      // If file doesn't exist, that's okay
      if (err.code !== 'ENOENT') {
        console.error(`Failed to rotate log file ${logFile}:`, err);
      }
    }

    // Clean old logs
    this.cleanOldLogs();
  }

  /**
   * Remove log files older than retainDays
   */
  cleanOldLogs() {
    const cutoffTime = Date.now() - (this.retainDays * 24 * 60 * 60 * 1000);
    
    try {
      const files = fs.readdirSync(this.logDir);

      for (const file of files) {
        // Skip current log files (without timestamp suffix)
        if (file.match(/^agent-\w+\.log$/)) {
          continue;
        }

        // Check rotated log files
        if (file.startsWith('agent-') && file.includes('.log.')) {
          const filePath = path.join(this.logDir, file);
          
          try {
            const stats = fs.statSync(filePath);
            
            if (stats.mtimeMs < cutoffTime) {
              fs.unlinkSync(filePath);
            }
          } catch (err) {
            console.error(`Failed to check/delete old log file ${file}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('Failed to clean old logs:', err);
    }
  }

  /**
   * Query recent log entries for an agent
   * @param {string} agentName - Agent name
   * @param {number} limit - Maximum number of entries to return
   * @returns {Array<Object>} Array of log entries (most recent first)
   */
  queryLogs(agentName, limit = 20) {
    const logFile = path.join(this.logDir, `agent-${agentName}.log`);

    if (!fs.existsSync(logFile)) {
      return [];
    }

    try {
      // Read entire file
      const content = fs.readFileSync(logFile, 'utf8');
      
      // Split into lines and parse JSON
      const lines = content.trim().split('\n').filter(line => line.trim());
      const entries = [];

      for (const line of lines) {
        try {
          entries.push(JSON.parse(line));
        } catch (err) {
          // Skip malformed lines
          console.error(`Failed to parse log line: ${line}`, err);
        }
      }

      // Return last N entries (most recent first)
      return entries.slice(-limit).reverse();
    } catch (err) {
      console.error(`Failed to read log file ${logFile}:`, err);
      return [];
    }
  }

  /**
   * Flush all pending log writes and close streams
   * @returns {Promise<void>}
   */
  async flush() {
    const closePromises = [];

    for (const [agentName, stream] of this.streams.entries()) {
      closePromises.push(
        new Promise((resolve) => {
          stream.end(() => {
            resolve();
          });
        })
      );
    }

    await Promise.all(closePromises);
    this.streams.clear();
  }
}

module.exports = Logger;

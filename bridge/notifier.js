/**
 * Notifier module for sending Telegram notifications about agent task outcomes
 * Implements Requirements 8.1, 8.2, 8.5, 8.6
 */
class Notifier {
  constructor(telegramAdapter, logger) {
    this.telegram = telegramAdapter;
    this.logger = logger;
    this.chatId = process.env.NOTIFY_CHAT_ID;
    this.progressInterval = parseInt(process.env.PROGRESS_INTERVAL_SEC || '30') * 1000;
    this.progressTimers = new Map(); // agentName -> { intervalId, startTime }
    this.enabled = true;

    // Handle missing NOTIFY_CHAT_ID gracefully (Requirement 8.5)
    if (!this.chatId) {
      this.enabled = false;
      if (this.logger) {
        this.logger.log({
          level: 'warn',
          agent: 'system',
          type: 'notifier_disabled',
          message: 'NOTIFY_CHAT_ID not set - notifications disabled'
        });
      }
      console.warn('⚠️  NOTIFY_CHAT_ID not set - notifications disabled');
    } else {
      if (this.logger) {
        this.logger.log({
          level: 'info',
          agent: 'system',
          type: 'notifier_enabled',
          message: `Notifier enabled for chat ID: ${this.chatId}`
        });
      }
    }
  }

  /**
   * Send a notification message to NOTIFY_CHAT_ID
   * Implements Requirement 8.1, 8.2
   * @param {string} message - Message text to send
   * @returns {Promise<void>}
   */
  async send(message) {
    if (!this.enabled) {
      return; // Silently skip if notifications disabled
    }

    if (!this.telegram) {
      console.warn('⚠️  Telegram adapter not available - cannot send notification');
      return;
    }

    try {
      await this.telegram.sendMessage(this.chatId, message);
      
      if (this.logger) {
        this.logger.log({
          level: 'info',
          agent: 'system',
          type: 'notification_sent',
          message: 'Notification sent successfully',
          text: message.substring(0, 100) // Log first 100 chars
        });
      }
    } catch (err) {
      if (this.logger) {
        this.logger.log({
          level: 'error',
          agent: 'system',
          type: 'notification_failed',
          message: `Failed to send notification: ${err.message}`,
          text: message.substring(0, 100)
        });
      }
      console.error('Failed to send notification:', err.message);
    }
  }

  /**
   * Send task completion notification
   * Implements Requirement 8.1
   * Format: ✅ [<agent_name>] selesai dalam <X> detik
   * @param {string} agentName - Agent name
   * @param {number} durationSeconds - Task duration in seconds
   * @returns {Promise<void>}
   */
  async sendCompletion(agentName, durationSeconds) {
    const message = `✅ [${agentName}] selesai dalam ${durationSeconds} detik`;
    await this.send(message);
  }

  /**
   * Send task error notification
   * Implements Requirement 8.2
   * Format: ❌ [<agent_name>] gagal: <error_message>
   * @param {string} agentName - Agent name
   * @param {string} error - Error message
   * @returns {Promise<void>}
   */
  async sendError(agentName, error) {
    const message = `❌ [${agentName}] gagal: ${error}`;
    await this.send(message);
  }

  /**
   * Send progress update notification
   * Implements Requirement 8.3
   * Format: ⏳ [<agent_name>] masih berjalan... (<X>s)
   * @param {string} agentName - Agent name
   * @param {number} elapsedSeconds - Elapsed time in seconds
   * @returns {Promise<void>}
   */
  async sendProgress(agentName, elapsedSeconds) {
    const message = `⏳ [${agentName}] masih berjalan... (${elapsedSeconds}s)`;
    await this.send(message);
  }

  /**
   * Send broadcast completion summary notification
   * Implements Requirement 6.3, 6.4, 6.5
   * @param {Object} result - Broadcast result object
   * @param {string[]} result.successful - Array of successful agent names
   * @param {Array<{agent: string, error: string}>} result.failed - Array of failed agents
   * @param {number} result.duration - Total duration in milliseconds
   * @returns {Promise<void>}
   */
  async sendBroadcastSummary(result) {
    const durationSeconds = Math.round(result.duration / 1000);
    const totalAgents = result.successful.length + result.failed.length;

    let message;

    // All agents completed successfully (Requirement 6.4)
    if (result.failed.length === 0) {
      message = `✅ Semua ${totalAgents} agent selesai dalam ${durationSeconds} detik`;
    }
    // Some agents failed (Requirement 6.5)
    else {
      message = `⚠️ Broadcast selesai dalam ${durationSeconds} detik\n`;
      message += `✅ Berhasil: ${result.successful.length} agent\n`;
      message += `❌ Gagal: ${result.failed.length} agent\n\n`;
      message += `Detail kegagalan:\n`;
      
      for (const failure of result.failed) {
        message += `• [${failure.agent}] ${failure.error}\n`;
      }
    }

    await this.send(message);
  }

  /**
   * Start progress tracking for an agent
   * Implements Requirement 8.3, 8.4
   * @param {string} agentName - Agent name
   */
  startProgressTracking(agentName) {
    if (!this.enabled) {
      return; // Skip if notifications disabled
    }

    // Clear any existing timer for this agent
    this.stopProgressTracking(agentName);

    const startTime = Date.now();

    // Send progress updates at configured interval
    const intervalId = setInterval(() => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      this.sendProgress(agentName, elapsed);
    }, this.progressInterval);

    this.progressTimers.set(agentName, { intervalId, startTime });

    if (this.logger) {
      this.logger.log({
        level: 'info',
        agent: agentName,
        type: 'progress_tracking_started',
        message: `Progress tracking started with ${this.progressInterval / 1000}s interval`
      });
    }
  }

  /**
   * Stop progress tracking for an agent
   * @param {string} agentName - Agent name
   */
  stopProgressTracking(agentName) {
    const timer = this.progressTimers.get(agentName);
    
    if (timer) {
      clearInterval(timer.intervalId);
      this.progressTimers.delete(agentName);

      if (this.logger) {
        const elapsed = Math.round((Date.now() - timer.startTime) / 1000);
        this.logger.log({
          level: 'info',
          agent: agentName,
          type: 'progress_tracking_stopped',
          message: `Progress tracking stopped after ${elapsed}s`
        });
      }
    }
  }

  /**
   * Stop all progress tracking (for shutdown)
   */
  stopAllProgressTracking() {
    for (const agentName of this.progressTimers.keys()) {
      this.stopProgressTracking(agentName);
    }
  }

  /**
   * Check if notifications are enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled;
  }
}

module.exports = Notifier;

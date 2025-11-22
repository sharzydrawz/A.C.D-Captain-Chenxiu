/**
 * Safely reply to an interaction, handling cases where the interaction
 * may have already been replied to or deferred
 * 
 * @param {import('discord.js').CommandInteraction} interaction - The interaction to reply to
 * @param {import('discord.js').InteractionReplyOptions} options - Reply options
 * @returns {Promise<void>}
 */
async function safeReply(interaction, options) {
  try {
    if (interaction.deferred) {
      return await interaction.editReply(options);
    } else if (interaction.replied) {
      return await interaction.followUp(options);
    } else {
      return await interaction.reply(options);
    }
  } catch (error) {
    // Silently ignore "Unknown interaction" errors (10062)
    if (error.code !== 10062) {
      console.error('Error sending interaction reply:', error);
      throw error;
    }
  }
}

/**
 * Safely send an error message to an interaction
 * 
 * @param {import('discord.js').CommandInteraction} interaction - The interaction to reply to
 * @param {string} message - Error message to send
 * @param {boolean} ephemeral - Whether the message should be ephemeral (default: true)
 * @returns {Promise<void>}
 */
async function sendError(interaction, message, ephemeral = true) {
  const errorMessage = {
    content: message.startsWith('❌') ? message : `❌ ${message}`,
    ephemeral,
  };

  return await safeReply(interaction, errorMessage);
}

/**
 * Safely send a success message to an interaction
 * 
 * @param {import('discord.js').CommandInteraction} interaction - The interaction to reply to
 * @param {string} message - Success message to send
 * @param {boolean} ephemeral - Whether the message should be ephemeral (default: false)
 * @returns {Promise<void>}
 */
async function sendSuccess(interaction, message, ephemeral = false) {
  const successMessage = {
    content: message.startsWith('✅') ? message : `✅ ${message}`,
    ephemeral,
  };

  return await safeReply(interaction, successMessage);
}

/**
 * Format milliseconds to a human-readable time string
 * 
 * @param {number} ms - Milliseconds to format
 * @returns {string} Formatted time string (e.g., "3:45" or "1:23:45")
 */
function formatTime(ms) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor(ms / (1000 * 60 * 60));
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    : `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Create a progress bar for music playback
 * 
 * @param {number} current - Current position in milliseconds
 * @param {number} total - Total duration in milliseconds
 * @param {number} size - Size of the progress bar (default: 15)
 * @returns {string} Progress bar string
 */
function createProgressBar(current, total, size = 15) {
  const progress = Math.round((current / total) * size);
  return '▬'.repeat(progress) + '🔘' + '▬'.repeat(size - progress);
}

module.exports = {
  safeReply,
  sendError,
  sendSuccess,
  formatTime,
  createProgressBar,
};

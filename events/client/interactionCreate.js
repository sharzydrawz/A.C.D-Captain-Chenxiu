const { Events, MessageFlags } = require('discord.js');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) {
        console.error(
          `No command matching ${interaction.commandName} was found.`
        );
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(`Error executing command ${interaction.commandName}:`, error);

        try {
          const errorMessage = {
            content: 'There was an error while executing this command!',
            flags: [MessageFlags.Ephemeral],
          };

          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
          } else {
            await interaction.reply(errorMessage);
          }
        } catch (replyError) {
          // If we can't send an error message, log it
          if (replyError.code !== 10062) {
            console.error('Failed to send error message:', replyError);
          }
        }
      }
    }

    if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (command && command.autocomplete) {
        try {
          await command.autocomplete(interaction);
        } catch (error) {
          console.error('Autocomplete error:', error);
          // Only try to respond if the interaction hasn't expired
          // Discord autocomplete interactions expire after 3 seconds
          if (error.code !== 10062) {
            try {
              await interaction.respond([]);
            } catch (respondError) {
              // Interaction already expired, ignore
              if (respondError.code !== 10062) {
                console.error('Discord.js Error:', respondError);
              }
            }
          }
        }
      }
    }
  },
};

const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nick')
    .setDescription("Change your or another user's nickname.")
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription(
          'The user to change the nickname for (leave blank to change your own)'
        )
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('nickname')
        .setDescription('The new nickname')
        .setRequired(true)
    ),
  async execute(interaction) {
    try {
      const user = interaction.options.getUser('user') || interaction.user;
      const nickname = interaction.options.getString('nickname');

      const member = interaction.guild.members.cache.get(user.id);
      if (!member) {
        return await interaction.reply({
          content: '❌ User not found in this guild.',
          ephemeral: true,
        });
      }

      if (
        interaction.member.permissions.has('ManageNicknames') ||
        user.id === interaction.user.id
      ) {
        try {
          await member.setNickname(nickname);
          return await interaction.reply({
            content: `✅ Nickname for **${user.username}** has been changed to **${nickname}**.`,
          });
        } catch (error) {
          console.error('Error changing nickname:', error);
          return await interaction.reply({
            content: "❌ I am unable to change this user's nickname. Please check my permissions.",
            ephemeral: true,
          });
        }
      } else {
        return await interaction.reply({
          content: '❌ You do not have `ManageNicknames` permission to change nicknames.',
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error('Nick command error:', error);

      const errorMessage = {
        content: '❌ An error occurred while changing the nickname. Please try again later.',
        ephemeral: true,
      };

      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(errorMessage);
        } else {
          await interaction.reply(errorMessage);
        }
      } catch (replyError) {
        console.error('Failed to send error message:', replyError);
      }
    }
  },
};

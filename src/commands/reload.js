const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const hotReload = require('../hotReload');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reload')
        .setDescription('Reload all commands from disk')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const count = hotReload.reloadAll();
            await interaction.editReply(`Reloaded ${count} commands. Registration with Discord will complete shortly.`);
        } catch (error) {
            console.error('[Reload] Error:', error);
            await interaction.editReply(`Failed to reload commands: ${error.message}`);
        }
    },
};

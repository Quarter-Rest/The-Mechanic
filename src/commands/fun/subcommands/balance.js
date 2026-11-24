const { MessageFlags, SlashCommandSubcommandBuilder } = require('discord.js');
const { getBalance } = require('../../../services/fun');

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('balance')
        .setDescription('Check how much money you have'),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        let balance;
        try {
            balance = await getBalance(interaction.user.id);
        } catch (error) {
            console.error('[Fun] Failed to read balance.', error.code ?? error.name);
            await interaction.editReply('Fun is unavailable right now. Try again in a bit.');
            return;
        }

        await interaction.editReply(`Your balance is **${balance.toLocaleString('en-US')}**.`);
    },
};

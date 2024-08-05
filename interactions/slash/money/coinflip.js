const { SlashCommandBuilder } = require("@discordjs/builders");
const { ActionRowBuilder, ButtonBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("coinflip")
        .setDescription("Create a coinflip challenge.")
        .addStringOption(option =>
            option
                .setName('amount')
                .setDescription('How much to wager. (optional)')
                .setRequired(false)),

    async execute(interaction, args) {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('heads')
                    .setLabel('Heads')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('tails')
                    .setLabel('Tails')
                    .setStyle(ButtonStyle.Primary),
            );

        var wager = interaction.options.getString('amount');
        if(wager == null)
        {
            wager = 0;
        }
        
        await interaction.reply({ content: "Please choose heads or tails for a wager of " + wager + " Frodecoins.", components: [row] });
		global.interactionMap.set(interaction.id, interaction.user);
        global.interactionMap.set(interaction.id + 'W', wager);
    },
};
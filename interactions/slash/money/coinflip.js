const { MessageEmbed, Collection } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageActionRow, MessageSelectMenu } = require('discord.js');
const { MessageButton } = require('discord.js');

var coinflipHelper = {
    title: 'Coinflip Helper',
	challenge: '',
	amount: 0,
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName("coinflip")
        .setDescription(
            "Create a coinflip challenge."
        ).addStringOption(option =>
            option
                .setName('amount')
                .setDescription('How much to wager. (optional)')
                .setRequired(false)),
    helper: coinflipHelper,

    async execute(interaction, args) {
        const row = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setCustomId('heads')
                    .setLabel('Heads')
                    .setStyle('PRIMARY'),
                new MessageButton()
                    .setCustomId('tails')
                    .setLabel('Tails')
                    .setStyle('PRIMARY')
        );
        coinflipHelper.challenge = interaction;
        coinflipHelper.amount = interaction.options.getString('amount');
        await interaction.reply({ content: "Please choose heads or tails.", components: [row] });
    },
};
const { MessageEmbed, Collection } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageActionRow, MessageSelectMenu } = require('discord.js');
const { MessageButton } = require('discord.js');
const { ComponentType } = require('discord.js');

const userMap = new Map(); // Create a Map to store user IDs

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
        const row = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setCustomId('heads')
                    .setLabel('Heads')
                    .setStyle('DANGER'),
                new MessageButton()
                    .setCustomId('tails')
                    .setLabel('Tails')
                    .setStyle('PRIMARY'),
            );
        var wager = interaction.options.getString('amount');
        await interaction.reply({ content: "Please choose heads or tails.", components: [row] });
		userMap.set(interaction.message.id, interaction.user.id); // Store the user's ID
    },
};
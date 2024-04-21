const { MessageEmbed, Collection } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageActionRow, MessageSelectMenu } = require('discord.js');
const { MessageButton } = require('discord.js');
const { ComponentType } = require('discord.js');

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
		//Set the data of the var buttonId to the buttons msg info
		var buttonId = row.components[0].customId;
		console.log(buttonId);
		
        var wager = interaction.options.getString('amount');
        await interaction.reply({ content: "Please choose heads or tails.", components: [row] });
		//global.interactionMap.set(msg, interaction.user); // Store the user's ID
		//console.log(global.interactionMap);
    },
};
// Deconstructed the constants we need in this file.

const { MessageEmbed, Collection } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageActionRow, MessageSelectMenu } = require('discord.js');

// Specifically for button interactions.
const { MessageButton } = require('discord.js');

module.exports = {
	// The data needed to register slash commands to Discord.
	data: new SlashCommandBuilder()
		.setName("coinflip")
		.setDescription(
			"Create a coinflip challenge."
		).addStringOption(option =>
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
					.setStyle('PRIMARY'),
				new MessageButton()
					.setCustomId('tails')
					.setLabel('Tails')
					.setStyle('PRIMARY')
		);
        var wager = interaction.options.getString('amount');
        //var messageText = interaction.options.getString('text');
		await interaction.reply({ content: "Please choose heads or tails.", components: [row] });
	},
};

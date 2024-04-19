const { MessageEmbed, Collection } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageActionRow, MessageSelectMenu } = require('discord.js');
const { MessageButton } = require('discord.js');

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

	async execute(interaction, args) {
		const row = new ActionRowBuilder()
			.addComponents(
				new MessageButton()
					.setCustomId('heads')
					.setLabel('Heads')
					.setStyle('PRIMARY'),
				new MessageButton()
					.setCustomId('tails')
					.setLabel('Tails')
					.setStyle('PRIMARY'),
				new String()
					.setCustomId('creator')
					.setLabel(interaction.user)
		);
        var wager = interaction.options.getString('amount');
		console.log(row.creator);
		await interaction.reply({ content: "Please choose heads or tails.", components: [row] });
	},
};
const { EmbedBuilder, Collection } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { ActionRowBuilder, MessageSelectMenu, ButtonBuilder } = require('discord.js');

// Specifically for button interactions.
const { MessageButton } = require('discord.js');

module.exports = {
	// The only part that makes this different from a default command.
	data: new SlashCommandBuilder()
		.setName("dice")
		.setDescription(
			"Roll a die"
		),

	async execute(interaction, args) {
		const row = new ActionRowBuilder()
			.addComponents(
				new ButtonBuilder()
					.setCustomId('d4')
					.setLabel('D4')
					.setStyle(1),
				new ButtonBuilder()
					.setCustomId('d6')
					.setLabel('D6')
					.setStyle(1),
				new ButtonBuilder()
					.setCustomId('d8')
					.setLabel('D8')
					.setStyle(1),
				new ButtonBuilder()
					.setCustomId('d10')
					.setLabel('D10')
					.setStyle(1),
				new ButtonBuilder()
					.setCustomId('d20')
					.setLabel('D20')
					.setStyle(1)
			);
		await interaction.reply({ content: "Please choose a die from the selection below.", components: [row] });
	},
};

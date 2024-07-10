const { EmbedBuilder, Collection } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageActionRow, MessageSelectMenu } = require('discord.js');

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
		const row = new MessageActionRow()
			.addComponents(
				new MessageButton()
					.setCustomId('d4')
					.setLabel('D4')
					.setStyle('PRIMARY'),
				new MessageButton()
					.setCustomId('d6')
					.setLabel('D6')
					.setStyle('PRIMARY'),
				new MessageButton()
					.setCustomId('d8')
					.setLabel('D8')
					.setStyle('PRIMARY'),
				new MessageButton()
					.setCustomId('d10')
					.setLabel('D10')
					.setStyle('PRIMARY'),
				new MessageButton()
					.setCustomId('d20')
					.setLabel('D20')
					.setStyle('PRIMARY')
			);
		await interaction.reply({ content: "Please choose a die from the selection below.", components: [row] });
	},
};

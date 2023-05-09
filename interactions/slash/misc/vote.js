const { MessageEmbed, Collection } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageActionRow, MessageSelectMenu } = require('discord.js');

// Specifically for button interactions.
const { MessageButton } = require('discord.js');
var Embeds = [];
module.exports = {
	// The only part that makes this different from a default command.
	data: new SlashCommandBuilder()
		.setName("vote")
		.setDescription(
			"Create a basic yes/no vote."
		)
		.addStringOption((option) =>
			option
				.setName("prompt")
				.setDescription("The topic of the vote.")
		),

	async execute(interaction, args) {
		let msg = args[1];

		const row = new MessageActionRow()
			.addComponents(
				new MessageButton()
					.setCustomId('no')
					.setLabel('YES')
					.setStyle('PRIMARY'),
				new MessageButton()
					.setCustomId('no')
					.setLabel('NO')
					.setStyle('PRIMARY'))
		await interaction.reply({ content: msg, components: [row] });
	},
};

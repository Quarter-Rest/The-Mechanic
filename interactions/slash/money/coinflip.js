// Deconstructed the constants we need in this file.

const { MessageEmbed, Collection } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageActionRow, MessageSelectMenu } = require('discord.js');

module.exports = {
	// The data needed to register slash commands to Discord.
	data: new SlashCommandBuilder()
		.setName("coinflip")
		.setDescription(
			"Create a coinflip challenge."
		).addStringOption(option =>
			option
				.setName('Amount')
				.setDescription('How much to wager. (optional)')
                .setRequired(false)),

	async execute(interaction) {
        await interaction.reply({ content: 'Workin\' on it.', ephemeral: true });

		const row = new MessageActionRow()
			.addComponents(
				new MessageButton()
					.setCustomId('heads')
					.setLabel('Heads')
					.setStyle('PRIMARY'),
				new MessageButton()
					.setCustomId('tails')
					.setLabel('Heads')
					.setStyle('PRIMARY')
		);
        var wager = interaction.options.getString('Amount');
        //var messageText = interaction.options.getString('text');
		interaction.channel.send({ content: row});
	},
};

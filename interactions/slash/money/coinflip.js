const { MessageEmbed, Collection } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageActionRow, MessageSelectMenu } = require('discord.js');
const { MessageButton } = require('discord.js');
const { ComponentType } = require('discord.js');

var user = '';

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
		user = interaction.user;
		await interaction.reply({ content: "Please choose heads or tails.", components: [row] });
		console.log(interaction + ' /// ' + interaction.creator + ' /// ' + this.creator);
	},
	creator: user
};
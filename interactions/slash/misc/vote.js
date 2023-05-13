const { MessageEmbed, Collection } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageActionRow, MessageSelectMenu } = require('discord.js');
const { EmbedBuilder } = require('discord.js');

module.exports = {
	// The only part that makes this different from a default command.
	data: new SlashCommandBuilder()
		.setName("vote")
		.setDescription(
			"Create a basic yes/no vote."
		)
		.addStringOption((option) =>
			option
				.setName("title")
				.setDescription("The title of the vote.")
		)
		.addStringOption((option) =>
			option
				.setName("description")
				.setDescription("The description of the vote.")
		),

	async execute(interaction, args) {
		let title = interaction.options.getString("title");
		let desc = interaction.options.getString("description");
		
		const exampleEmbed = new MessageEmbed()
		.setColor(0x0099FF)
		.setTitle(title)
		.setAuthor({ name: interaction.user.username, iconURL: interaction.user.avatarURL() })
		.setDescription(desc)
		.setThumbnail('https://th.bing.com/th/id/R.7e18af4777dbfce8a8f36e742ac7c318?rik=id88H6t%2fXM9OHA&riu=http%3a%2f%2fwww.technologybloggers.org%2fwp-content%2fuploads%2f2011%2f06%2fThe-United-Nations-logo.png&ehk=LBNkq62sxRCgriL6bRuJ0ZCqP5CPBfRT1mgPSqx3zaI%3d&risl=&pid=ImgRaw&r=0')
		.setTimestamp()

		const replied = await interaction.reply({ embeds: [exampleEmbed], fetchReply: true });
		await replied.react('👍');
		await replied.react('👎');
		await replied.react('⚪');
	},
};

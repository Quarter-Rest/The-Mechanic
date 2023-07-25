// I'm not gonna bother making the vote commands work together because I don't really understand javascript - griffon

const { MessageEmbed, Collection } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageActionRow, MessageSelectMenu } = require('discord.js');
const { EmbedBuilder } = require('discord.js');
const CooldownTime = 172800000;
const ThreadID = '1107152890465890334';

module.exports = {
	// The only part that makes this different from a default command.
	data: new SlashCommandBuilder()
		.setName("vote")
		.setDescription(
			"Create a basic yes/no vote for anything."
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
		run(interaction, args);
	}
};

async function run(interaction, args) {
	let title = interaction.options.getString("title");
	let desc = interaction.options.getString("description");

	if(!title || !desc) return;

	if(interaction.channel.id == ThreadID)
	{
		interaction.reply({content: "Please use the /un_vote command instead."})
		return;
	}

	CreateVote(interaction, user, title, desc);
}

async function CreateVote(interaction, title, desc)
{
	// finished doing checks
	const exampleEmbed = new MessageEmbed()
	.setColor(0x0099FF)
	.setTitle(title)
	.setAuthor({ name: interaction.user.username, iconURL: interaction.user.avatarURL() })
	.setDescription(desc)
	.addFields(
		{ name: 'Vote Yay', value: '👍', inline: true },
		{ name: 'Vote Nay', value: '👎', inline: true },
		{ name: 'Abstain', value: '⚪', inline: true },
	)
	.setThumbnail('https://th.bing.com/th/id/R.7e18af4777dbfce8a8f36e742ac7c318?rik=id88H6t%2fXM9OHA&riu=http%3a%2f%2fwww.technologybloggers.org%2fwp-content%2fuploads%2f2011%2f06%2fThe-United-Nations-logo.png&ehk=LBNkq62sxRCgriL6bRuJ0ZCqP5CPBfRT1mgPSqx3zaI%3d&risl=&pid=ImgRaw&r=0')
	.setTimestamp()

	const replied = await interaction.reply({ embeds: [exampleEmbed], fetchReply: true });
	await replied.react('👍');
	await replied.react('👎');
	await replied.react('⚪');
}

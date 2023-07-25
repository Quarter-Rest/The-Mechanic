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
				.setRequired(true)
		)
		.addStringOption((option) =>
			option
				.setName("description")
				.setDescription("The description of the vote.")
				.setRequired(true)
		)
		.addStringOption((option) =>
			option
				.setName("thumbnail")
				.setDescription("Optional url of the thumbnail image.")
		),

	async execute(interaction, args) {
		run(interaction, args);
	}
};

async function run(interaction, args) {
	let title = interaction.options.getString("title");
	let desc = interaction.options.getString("description");
	let thumbnail = interaction.options.getString("thumbnail");

	if(!thumbnail)
		thumbnail = interaction.user.avatarURL();

	if(!title || !desc) return;

	if(interaction.channel.id == ThreadID)
	{
		interaction.reply({content: "Please use the /un_vote command instead."})
		return;
	}

	CreateVote(interaction, title, desc, thumbnail);
}

async function CreateVote(interaction, title, desc, thumbnail)
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
	.setThumbnail(thumbnail)
	.setTimestamp()

	const replied = await interaction.reply({ embeds: [exampleEmbed], fetchReply: true });
	await replied.react('👍');
	await replied.react('👎');
	await replied.react('⚪');
}

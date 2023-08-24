// I'm not gonna bother making the vote commands work together because I don't really understand javascript - griffon

const { MessageEmbed, Collection } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageActionRow, MessageSelectMenu } = require('discord.js');
const { EmbedBuilder } = require('discord.js');
const { Nsfw } = require('pornox')

module.exports = {
	// The only part that makes this different from a default command.
	data: new SlashCommandBuilder()
		.setName("randomnsfw")
		.setDescription(
			"Get random nsfw."
		),

	async execute(interaction, args) {
		run(interaction, args);
        interaction.message.delete();
	}
};

async function run(interaction, args) {

    var title = "";
    var imageURL = 'https://i.imgur.com/AfFp7pu.png';

    print(Nsfw.ass())
    return;

	// finished doing checks
	const exampleEmbed = new MessageEmbed()
	.setColor(0x0099FF)
	.setTitle(title)
	.addFields(
		{ name: 'Squirt', value: '💦', inline: true },
		{ name: 'Bad', value: '❌', inline: true },
	)
    .setImage('https://i.imgur.com/AfFp7pu.png')
	.setTimestamp()

	const replied = await interaction.reply({ embeds: [exampleEmbed], fetchReply: true });
}
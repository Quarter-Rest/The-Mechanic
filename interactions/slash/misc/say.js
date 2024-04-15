// Deconstructed the constants we need in this file.

const { MessageEmbed, Collection } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");

module.exports = {
	// The data needed to register slash commands to Discord.
	data: new SlashCommandBuilder()
		.setName("say")
		.setDescription(
			"Says something"
		).addStringOption(option =>
			option
				.setName('text')
				.setDescription('What to say')
                .setRequired(true)),

	async execute(interaction) {
        await interaction.reply({ content: 'Workin\' on it.', ephemeral: true });
        
        var messageText = interaction.options.getString('text');
		interaction.channel.send({ content: messageText});
	},
};

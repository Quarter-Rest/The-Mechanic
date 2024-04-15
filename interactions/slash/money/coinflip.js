// Deconstructed the constants we need in this file.

const { MessageEmbed, Collection } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");

module.exports = {
	// The data needed to register slash commands to Discord.
	data: new SlashCommandBuilder()
		.setName("coinflip")
		.setDescription(
			"Check your money."
		),

	async execute(interaction) {
        var messageText = "TY HASN\'T DONE IT YET";

		

		// Replies to the interaction!
		await interaction.reply({
			content: messageText,
		});
	},
};

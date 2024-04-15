// Deconstructed the constants we need in this file.

const { MessageEmbed, Collection } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");

module.exports = {
	// The data needed to register slash commands to Discord.
	data: new SlashCommandBuilder()
		.setName("restart")
		.setDescription(
			"Restart."
		),

	async execute(interaction) {
        if (global.adminIDs.includes(message.author.id))
        {
            // Replies to the interaction!
            await interaction.reply({
                content: "Restarting...",
            });
		    process.exit();
        }
        else 
        {
            await interaction.reply({
                content: "You cannot do this.",
            });
        }
	},
};

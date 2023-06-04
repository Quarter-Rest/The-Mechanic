const { MessageEmbed, Collection } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageActionRow, MessageSelectMenu } = require('discord.js');

// Specifically for button interactions.
const { MessageButton } = require('discord.js');

module.exports = {
	// The only part that makes this different from a default command.
	data: new SlashCommandBuilder()
		.setName("supermention")
		.setDescription(
			"SuperMention:tm: a user!"
		).addStringOption((option) =>
        option
            .setName("user")
            .setDescription("The user you want to super react. Should be like: @User#0000")
    ),

	async execute(interaction, args) {
        let name = interaction.options.getString("user");
        for (let index = 0; index < 5; index++) {
            await interaction.channel.send(`${name}`);
        }
	},
};

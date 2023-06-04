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
        let messages = [];
        for (let index = 0; index < 4; index++) {
            messages.push(await interaction.channel.send(`${name}`));
        }

        messages.forEach(msg => {
            msg.delete();
        });

        interaction.reply({
            content: `SUPER MENTION! HELLO ${name} :)`,
        });
	},
};

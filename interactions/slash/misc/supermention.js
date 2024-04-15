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
        ).addStringOption((message) =>
            message
            .setName("message-optional")
            .setDescription("The message after the reaction. Optional.")
    ),

	async execute(interaction, args) {

        if(interaction.member.roles.cache.some((role) => role.name === 'Server Booster') == false && interaction.member.id != `178273444041981952`)
        {
            await interaction.reply("Sorry loser but you can't use this command!");
            return;
        }

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

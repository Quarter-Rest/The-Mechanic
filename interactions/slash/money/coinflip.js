const { MessageEmbed, Collection } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageActionRow, MessageSelectMenu } = require('discord.js');
const { MessageButton } = require('discord.js');

const usernames = new Map();

module.exports = {
	data: new SlashCommandBuilder()
		.setName("coinflip")
		.setDescription(
			"Create a coinflip challenge."
		).addStringOption(option =>
			option
				.setName('amount')
				.setDescription('How much to wager. (optional)')
                .setRequired(false)),

	async execute(interaction, args) {
		const row = new MessageActionRow()
			.addComponents(
				new MessageButton()
					.setCustomId('heads')
					.setLabel('Heads')
					.setStyle('PRIMARY'),
				new MessageButton()
					.setCustomId('tails')
					.setLabel('Tails')
					.setStyle('PRIMARY')
		);
        var wager = interaction.options.getString('amount');
		await interaction.reply({ content: "Please choose heads or tails.", components: [row] });

		// Store the username of the person who sent the coinflip command.
        usernames.set(interaction.message.id, interaction.user.username);
	},
};

module.exports = {
    id: "heads",

    async execute(interaction) {
        var flip = Math.floor(Math.random() * 2);
        var wOrL = '';
        if(flip == 1) {
            wOrL = '**won**'
        }
        else {
            wOrL = '**lost**'
        }
        // Retrieve the username of the person who sent the coinflip command.
        const username = usernames.get(interaction.message.id);
        await interaction.update({
            content: interaction.user.username + " selected heads against " + username + ' and ' + wOrL + '!',
            components: [] // This removes the buttons
        });
        return;
    },
};

module.exports = {
    id: "tails",

    async execute(interaction) {
        var flip = Math.floor(Math.random() * 2);
        var wOrL = '';
        if(flip == 1) {
            wOrL = '**lost**'
        }
        else {
            wOrL = '**won**'
        }
        // Retrieve the username of the person who sent the coinflip command.
        const username = usernames.get(interaction.message.id);
        await interaction.update({
            content: interaction.user.username + " selected tails against " + username + ' and ' + wOrL + '!',
            components: [] // This removes the buttons
        });
        return;
    },
};
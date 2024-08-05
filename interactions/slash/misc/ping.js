/**
 * @file Sample help command with slash command.
 * @author Naman Vrati
 * @author Thomas Fournier <thomas@artivain.com>
 * @since 3.0.0
 * @version 3.1.0
 */

// Deconstructed the constants we need in this file.

const { EmbedBuilder, Collection } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

module.exports = {
	// The data needed to register slash commands to Discord.
	data: new SlashCommandBuilder()
		.setName("ping")
		.setDescription(
			"Ping and select menu test."
		),

	async execute(interaction) {
		/**
		 * @type {EmbedBuilder}
		 * @description Help command's embed
		 */
        const row = new ActionRowBuilder()
			.addComponents(
				new StringSelectMenuBuilder()
					.setCustomId('select')
					.setPlaceholder('Nothing selected')
					.addOptions(
						new StringSelectMenuOptionBuilder()
							.setLabel('Select me')
							.setDescription('This is a description')
							.setValue('first_option'),
						new StringSelectMenuOptionBuilder()
							.setLabel('You can select me too')
							.setDescription('This is also a description')
							.setValue('second_option')
					)
			);

		await interaction.reply({ content: 'Pong!', components: [row] });
	},
};

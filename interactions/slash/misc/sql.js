// Deconstructed the constants we need in this file.

const { MessageEmbed, Collection } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const {InteractionAPI} = require('../interaction-api')

module.exports = {
	// The data needed to register slash commands to Discord.
	data: new SlashCommandBuilder()
		.setName("sql")
		.setDescription(
			"Admin only."
		)
		.addStringOption((option) =>
			option
				.setName("operation")
				.setDescription("")
				.setRequired(true)
				.addChoices(
					{ name: 'SET', value: 'set' },
					{ name: 'WIP_DELETE', value: 'delete' },
				)
		)
		.addStringOption((option) =>
			option
				.setName("tablename")
				.setDescription("")
				.setRequired(true)
		)
		.addStringOption((option) =>
			option
				.setName("valuename")
				.setDescription("")
				.setRequired(true)
		)
		.addStringOption((option) =>
			option
				.setName("value")
				.setDescription("")
				.setRequired(true)
		)
		.addUserOption(option =>
			option
				.setName('target')
				.setDescription('')
				.setRequired(true)
		),

	async execute(interaction) {
        if (global.adminIDs.includes(interaction.member.id) == false)
		{
			await interaction.reply({
                content: "You cannot do this.",
            });
			return
		}
        
		const operation = interaction.options.getString("operation")

		const tableName = interaction.options.getString("tablename")
		const valueName = interaction.options.getString("valuename")
		const value = interaction.options.getString("value")
		const target = interaction.options.getUser('target');

		await InteractionAPI.CheckUserInTable(target.id, target.username, tableName)
		
		if (operation == "set")
		{
			await InteractionAPI.SetValueInTable(target.id, tableName, valueName, value)

			await interaction.reply({
				content: "Restarting...",
			});
		}
		else
		{
			await interaction.reply({
				content: "Unimplemented...",
			});
		}
	
	},
};

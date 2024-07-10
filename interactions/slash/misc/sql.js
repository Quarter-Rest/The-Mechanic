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
				.setDescription("operation")
				.setRequired(true)
				.addChoices(
					{ name: 'GET_VALUE', value: 'get_value' },
					{ name: 'GET_ROW', value: 'get_row' },
					{ name: 'GET_TABLE', value: 'get_table' },
					{ name: 'SET', value: 'set' },
					{ name: 'WIP_DELETE', value: 'delete' },
				)
		)
		.addStringOption((option) =>
			option
				.setName("tablename")
				.setDescription("Always required.")
				.setRequired(true)
		)
		.addUserOption(option =>
			option
				.setName('target')
				.setDescription("Needed for SET, GET_ROW, GET_VALUE")
		)
		.addStringOption((option) =>
			option
				.setName("valuename")
				.setDescription("Needed for SET, GET_VALUE")
		)
		.addStringOption((option) =>
			option
				.setName("value")
				.setDescription("Needed for SET")
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

		if (target)
			await InteractionAPI.CheckUserInTable(target.id, tableName)
		
		if (operation == "set")
		{
			await InteractionAPI.SetValueInTable(target.id, tableName, valueName, value)

			await interaction.reply({
				content: "Successfully " + operation + " " + valueName + " to " + value + " in " + tableName + " for " + target.username,
			});
		}
		else if (operation == "get_value")
		{
			const value = await InteractionAPI.GetValueInTable(target.id, tableName, valueName)

			await interaction.reply({
				content: valueName + " = " + JSON.stringify(value) + " for " + target.username + " in " + tableName,
			});
		}
		else if (operation == "get_row")
		{
			const row = await InteractionAPI.GetRowInTable(target.id, tableName)

			await interaction.reply({
				content: target.username + " in " + tableName + " = " + JSON.stringify(row),
			});
		}
		else if (operation == "get_table")
		{
			const table = await InteractionAPI.GetTable(tableName)

			await interaction.reply({
				content: JSON.stringify(table),
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

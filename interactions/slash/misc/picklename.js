
const {  SlashCommandBuilder, EmbedBuilder } = require('discord.js')

const {InteractionAPI} = require('../interaction-api')

const sqlTableName = "PICKLEBALL"

module.exports = {
	// The data needed to register slash commands to Discord.
	data: new SlashCommandBuilder()
		.setName("picklename")
		.setDescription(
			"Rename yourself on the Pickleball scoreboard."
		)
		.addStringOption((option) =>
			option
				.setName("newname")
				.setDescription("Your new name.")
				.setRequired(true)
		),

	async execute(interaction) {
        // Immediately send a reply
        const originalReply = await interaction.reply({ content: "Loading...", ephemeral: true })
		await InteractionAPI.CheckUserInTable(interaction.user.id, sqlTableName)

		const name = interaction.options.getString("newname")

		await InteractionAPI.SetValueInTable(interaction.user.id, sqlTableName, "NICKNAME", name)

		await interaction.editReply({ content: "Done!" })
	},
}

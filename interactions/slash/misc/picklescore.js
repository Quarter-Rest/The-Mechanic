
const {  SlashCommandBuilder, EmbedBuilder } = require('discord.js')
const { APIEmbedField } = require("discord-api-types/v10");

const {InteractionAPI} = require('../interaction-api')

const sqlTableName = "PICKLEBALL"
const pickleImg = "https://static.vecteezy.com/system/resources/previews/015/273/603/non_2x/pickleball-background-with-a-yellow-ball-over-the-field-line-pickleball-background-with-negative-space-to-put-your-text-great-for-posters-flyers-banners-etc-free-vector.jpg"
const pickleColor = "#529249"
module.exports = {
	// The data needed to register slash commands to Discord.
	data: new SlashCommandBuilder()
		.setName("picklescore")
		.setDescription(
			"Get the current scoreboard for Pickleball."
		),

	async execute(interaction) {
        // Immediately send a reply
        const originalReply = await interaction.reply({ content: "Loading..."})
		const embed = await this.GenerateScoreboard()
		await interaction.editReply({ content: "", components: [embed] })
	},

	async GenerateScoreboard()
	{
		console.log("Generating")
		const table = await InteractionAPI.GetTable(sqlTableName)

		let playerScores = []
		for (let i = 0; i < table.length; i++) {
			const row = table[i]
			const wins = row.WINS
			const losses = row.LOSSES

            let score = new APIEmbedField()
			score.name = row.NICKNAME
			score.value = "Wins: " + wins + "\nLosses: " + losses
			
			console.log(score)

			playerScores.push( score )
		}

		console.log("Got players " + playerScores.length)

		const embed = new EmbedBuilder()
			.setTitle("Pickleball Scoreboard")
			//.addFields(playerScores)
			.setThumbnail(pickleImg)
			.setColor(pickleColor);

		return embed
	},
}

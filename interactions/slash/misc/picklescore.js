
const {  SlashCommandBuilder, EmbedBuilder } = require('discord.js')

const {InteractionAPI} = require('../interaction-api')

const sqlTableName = "PICKLEBALL"
const pickleImg = "https://i.imgur.com/WVb7VHl.png"
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
		await interaction.editReply({ content: "", embeds: [embed] })
	},

	async GenerateScoreboard()
	{
		const table = await InteractionAPI.GetTable(sqlTableName)

		let playerScores = []
		for (let i = 0; i < table.length; i++) {
			const row = table[i]
			const wins = row.WINS
			const losses = row.LOSSES

            let score = {
				name: row.NICKNAME,
				value: "Wins: " + wins + "\nLosses: " + losses
			}
			playerScores.push( score )
		}

		var embed = new EmbedBuilder()
			.setTitle("Pickleball Scoreboard")
			.setThumbnail(pickleImg)
			.setColor(pickleColor);

		playerScores.forEach(score => {
			embed.addFields({ name: score.name, value: score.value },)
		});

		return embed
	},
}

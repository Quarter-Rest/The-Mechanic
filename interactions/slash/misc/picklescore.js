
const {  SlashCommandBuilder, EmbedBuilder, APIEmbedField } = require('discord.js')

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
        const originalReply = await interaction.reply({ content: "Loading...", ephemeral: true })
		const embed = await this.GenerateScoreboard(interaction)
		await interaction.editReply({ content: "", components: [embed] })
	},

	async GenerateScoreboard(interaction)
	{
		const table = await InteractionAPI.GetTable(sqlTableName)

		const members = await interaction.guild.members.fetch()
        // Filter out anyone without the Pickler role
        const players = members.filter(member => member.roles.cache.has(global.PicklerRoleID))

        let playerScores = []
        await players.forEach(async member => {
			await InteractionAPI.CheckUserInTable(id, sqlTableName)

			const row = InteractionAPI.GetRowInTable(member.id, sqlTableName)
			const wins = row.WINS
			const losses = row.LOSSES

            let score = APIEmbedField()
			score.name = member.username
			score.value = "Wins: " + wins + "\nLosses: " + losses
		
			playerScores.push( score )
        })

		const embed = new EmbedBuilder()
			.setTitle("Pickleball Scoreboard")
			.addFields(playerScores)
			.setThumbnail(pickleImg)
			.setColor(pickleColor);

		return embed
	},
}

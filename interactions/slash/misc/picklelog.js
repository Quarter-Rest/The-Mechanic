
const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, SlashCommandBuilder, ComponentType } = require('discord.js')
const PicklerRoleID = "1257548633956421722"

module.exports = {
	// The data needed to register slash commands to Discord.
	data: new SlashCommandBuilder()
		.setName("picklelog")
		.setDescription(
			"Log a game of Pickleball."
		)
        .addIntegerOption(option =>
            option.setName('winningteamcount')
                .setDescription('Number of players on the WINNING team.')
                .setMinValue(1)
                .setMaxValue(4)
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('losingteamcount')
                .setDescription('Number of players on the LOSING team.')
                .setMinValue(1)
                .setMaxValue(4)
                .setRequired(true)
        ),

	async execute(interaction) {
        // Immediately send a reply
        const originalReply = await interaction.reply({ content: "Loading...", ephemeral: true })

        const numPlayersWin = interaction.options.getInteger("winningteamcount")
        const numPlayersLose = interaction.options.getInteger("losingteamcount")

        // Get all members in the guild
        const members = await interaction.guild.members.fetch()
        // Filter out anyone without the Pickler role
        const players = members.filter(member => member.roles.cache.has(PicklerRoleID))

        let playerOptions = []
        players.forEach(member => {
            let option = new StringSelectMenuOptionBuilder()
                .setLabel(member.displayName + " (" + member.user.username + ")")
                .setDescription("Maybe their career stats here?")
                .setValue(member.id)

            playerOptions.push( option )
        })

        // Add the option for custom players
        let customPlayerOption = new StringSelectMenuOptionBuilder()
                .setLabel("Custom Player")
                .setDescription("Will not track stats for this player.")
                .setValue( "custom")
        playerOptions.push( customPlayerOption )

        // Setup winner response
        let winningRow = MakePlayerSelection(playerOptions, numPlayersWin)
        
		let newReply = await interaction.editReply({ content: 'Select winners.', components: [winningRow] })
        
        const collector = newReply.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 3_600_000 });


        const originalID = interaction.id
        collector.on('collect', async i => {
            if (OnCollect(i, originalID, numPlayersWin, true))
                collector.stop();
        });

        collector.on('end', async () => {
            // Setup loser response
            let losingRow = MakePlayerSelection(playerOptions, numPlayersLose)
            newReply = await interaction.editReply({ content: 'Select losers.', components: [losingRow] })

            collector.on('collect', async i => {
                OnCollect(i, originalID, numPlayersLose, false);
            });
        })

	},
}

function OnCollect(interaction, originalID, expectedSize, isWinners)
{
    console.log(interaction.id + " | " + originalID + " || " + interaction.values.size + " | " + expectedSize)
    if (interaction.id != originalID || interaction.values.size != expectedSize)
        return false
    console.log(interaction.values)

    return true
}

function MakePlayerSelection(playerOptions, numPlayers) {
    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("select")
            .setPlaceholder("Select a player.")
            .addOptions(playerOptions)
            .setMinValues(numPlayers)
            .setMaxValues(numPlayers)
    ) 

    return row
}
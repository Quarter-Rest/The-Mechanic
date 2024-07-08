
const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, SlashCommandBuilder, ComponentType } = require('discord.js')
const PicklerRoleID = "1257548633956421722"

const InteractionAPI = require('../interaction-api')

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

		await InteractionAPI.CheckUserInTable(interaction.member.id, "PICKLEBALL")

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
        let winningRow = MakePlayerSelection(playerOptions, numPlayersWin, "selectWinners")
        
		let newReply = await interaction.editReply({ content: 'Select winners.', components: [winningRow] })
        
        const collector = newReply.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 3_600_000 });

        collector.on('collect', async i => {
            if (OnCollect(i, numPlayersWin, true, "selectWinners"))
            {
                collector.stop()
                i.deferUpdate()
            }
        });

        collector.on('end', async (interact) => {
            // Setup loser response
            let losingRow = MakePlayerSelection(playerOptions, numPlayersLose, "selectLosers")
            newReply = await interaction.editReply({ content: 'Select losers.', components: [losingRow] })
            const loserCollecter = newReply.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 3_600_000 });

            loserCollecter.on('collect', async i => {
                if (OnCollect(i, numPlayersLose, false, "selectLosers"))
                {
                    collector.stop()
                    i.deferUpdate()
                    // some message
                    await interaction.editReply({ content: 'All done!', components: [] })
                }
            });
        })

	},
}

function OnCollect(interaction, expectedSize, isWinners, selectMenuID)
{
    console.log(interaction.customId + " || " + interaction.values.length + " | " + expectedSize)
    if (interaction.customId != selectMenuID || interaction.values.length != expectedSize)
        return false
    console.log(interaction.values)

    return true
}

function MakePlayerSelection(playerOptions, numPlayers, selectMenuID) {
    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(selectMenuID)
            .setPlaceholder("Select a player.")
            .addOptions(playerOptions)
            .setMinValues(numPlayers)
            .setMaxValues(numPlayers)
    ) 

    return row
}
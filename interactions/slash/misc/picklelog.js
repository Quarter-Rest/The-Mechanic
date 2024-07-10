
const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, SlashCommandBuilder, ComponentType } = require('discord.js')
global.PicklerRoleID = "1257548633956421722"

const {InteractionAPI} = require('../interaction-api')

const GenerateScoreboard = require("./picklescore").GenerateScoreboard

const sqlTableName = "PICKLEBALL"

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
        )
		.addBooleanOption(option =>
			option.setName('shouldremove')
				.setDescription('Should this log remove score instead of adding it? Such as to undo an accidental log.')
		),

	async execute(interaction) {
        // Immediately send a reply
        const originalReply = await interaction.reply({ content: "Loading...", ephemeral: true })

        const numPlayersWin = interaction.options.getInteger("winningteamcount")
        const numPlayersLose = interaction.options.getInteger("losingteamcount")
		const shouldRemove = interaction.options.getBoolean("shouldremove")

        // Get all members in the guild
        const members = await interaction.guild.members.fetch()
        // Filter out anyone without the Pickler role
        const players = members.filter(member => member.roles.cache.has(global.PicklerRoleID))

        let playerOptions = []
        players.forEach(member => {
            let option = new StringSelectMenuOptionBuilder()
                .setLabel(member.displayName + " (" + member.user.username + ")")
                .setDescription("Maybe their career stats here?")
                .setValue(member.id)

            playerOptions.push( option )
        })

        // Add the option for custom players
        // let customPlayerOption = new StringSelectMenuOptionBuilder()
        //         .setLabel("Custom Player")
        //         .setDescription("Will not track stats for this player.")
        //         .setValue( "custom")
        // playerOptions.push( customPlayerOption )

        // Setup winner response
        let winningRow = MakePlayerSelection(playerOptions, numPlayersWin, "selectWinners")
        
		let newReply = await interaction.editReply({ content: 'Select winners.', components: [winningRow] })
        
        const collector = newReply.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 3_600_000 });

		var selectedPlayers = []
        collector.on('collect', async i => {
            if (OnCollect(i, numPlayersWin, true, "selectWinners", selectedPlayers))
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
                if (OnCollect(i, numPlayersLose, false, "selectLosers", selectedPlayers))
                {
                    collector.stop()
                    i.deferUpdate()
                    // some message
                    await interaction.editReply({ content: 'All done!', components: [] })

					var embed = await GenerateScoreboard()

					var text = interaction.user.username + " just logged a game.\nIt involved: "
					selectedPlayers.forEach((sqlValue) => {
						console.log(sqlValue + "\n" + JSON.stringify(sqlValue))
						text += sqlValue.NICKNAME + ", ";
					});

					interaction.channel.send({ content: text, embeds: [embed] })
                }
            });
        })

	},
}

function OnCollect(interaction, expectedSize, isWinners, selectMenuID, outSelected, shouldRemove)
{
    if (interaction.customId != selectMenuID || interaction.values.length != expectedSize)
        return false

	let columm = "WINS"
	if(isWinners == false)
		columm = "LOSSES"
	interaction.values.forEach(async (id) => {
		
		await InteractionAPI.CheckUserInTable(id, sqlTableName)

		let sqlValue =  await InteractionAPI.GetValueInTable(id, sqlTableName, columm)
		let value = -2

		if (isWinners)
			value = sqlValue.WINS
		else
			value = sqlValue.LOSSES

		if (value < 0)
		{
			console.log("Error: bad value")
			return false
		}

		outSelected.push(await InteractionAPI.GetRowInTable(id, sqlTableName))

		let add = 1
		if(shouldRemove)
			add = -1

		await InteractionAPI.SetValueInTable(id, sqlTableName, columm, value + add)
	});

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
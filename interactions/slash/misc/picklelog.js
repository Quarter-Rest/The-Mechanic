
const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, SlashCommandBuilder } = require('discord.js');
const PicklerRoleID = "1257548633956421722";

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
        await interaction.reply({ content: "Loading...", ephemeral: true });

        const numPlayersWin = interaction.options.getInteger("winningteamcount");
        const numPlayersLose = interaction.options.getInteger("losingteamcount");

        // Get all members in the guild
        const members = await interaction.guild.members.fetch();
        // Filter out anyone without the Pickler role
        const players = members.filter(member => member.roles.cache.has(PicklerRoleID));

        let playerOptions = []
        players.forEach(member => {
            let option = new StringSelectMenuOptionBuilder()
                .setLabel(member.displayName + " (" + member.user.username + ")")
                .setDescription("Maybe their career stats here?")
                .setValue(member.id);

            playerOptions.push( option );
        });

        // Add the option for custom players
        let customPlayerOption = new StringSelectMenuOptionBuilder()
                .setLabel("Custom Player")
                .setDescription("Will not track stats for this player.")
                .setValue( "custom");
        playerOptions.push( customPlayerOption );

        // Setup winner response
        let winningRows = []
        for (let i = 0; i < numPlayersWin; i++) {
            winningRows.push(MakePlayerSelectionRow(playerOptions, i))
        }
        
		const winnerReply = await interaction.editReply({ content: 'Select winners.', components: winningRows });
        
        var winners
        try {
            winners = await winnerReply.awaitMessageComponent({ time: 60_000 });
        } catch (e) {
            await interaction.editReply({ content: 'Confirmation not received within 1 minute, cancelling', components: [] });
            return
        }

        // Setup loser response
        let losingRows = []
        for (let i = 0; i < numPlayersLose; i++) {
            losingRows.push(MakePlayerSelectionRow(playerOptions, i))
        }

        const loserReply = await interaction.editReply({ content: 'Select losers.', components: losingRows });
        
        var losers
        try {
            losers = await loserReply.awaitMessageComponent({ time: 60_000 });
        } catch (e) {
            await interaction.editReply({ content: 'Confirmation not received within 1 minute, cancelling', components: [] });
            return
        }


	},
};


async function MakePlayerSelectionRow(playerOptions, uid) {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("select" + uid)
            .setPlaceholder("Select a player.")
            .addOptions(playerOptions)
    ); 
}
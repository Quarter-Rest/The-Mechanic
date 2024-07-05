
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
            option.setName('playercount')
                .setDescription('Number of players in the game.')
                .setMinValue(2)
                .setMaxValue(6)
                .setRequired(true)
        ),

	async execute(interaction) {
        // Immediately send a reply
        await interaction.reply({ content: "Loading...", ephemeral: true });

        const numPlayers = interaction.options.getInteger("playercount");

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


        let customPlayerOption = new StringSelectMenuOptionBuilder()
                .setLabel("Custom Player")
                .setDescription("Will not track stats for this player.")
                .setValue( "custom");
        playerOptions.push( customPlayerOption );

        let rows = []
        for (let i = 0; i < numPlayers; i++) {
            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId("select")
                    .setPlaceholder("Select a player.")
                    .addOptions(playerOptions)
            );
            rows.push(row)
        }

		await interaction.editReply({ content: 'test!', components: rows });
	},
};

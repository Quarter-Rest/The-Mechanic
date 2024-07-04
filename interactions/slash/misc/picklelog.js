
const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, SlashCommandBuilder } = require('discord.js');
const PicklerRoleID = "1257548633956421722";

module.exports = {
	// The data needed to register slash commands to Discord.
	data: new SlashCommandBuilder()
		.setName("picklelog")
		.setDescription(
			"Log a game of Pickleball."
		),

	async execute(interaction) {
        // Get all members in the guild
        const members = interaction.guild.members.cache;
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

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("select")
                .setPlaceholder("Select a player.")
                .addOptions(playerOptions)
        );

		await interaction.reply({ content: 'test!', components: [row] });
	},
};


const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, SlashCommandBuilder } = require('discord.js');
const PicklerRoleID = "1257548633956421722";
const commandName = "picklelog";

module.exports = {
	// The data needed to register slash commands to Discord.
	data: new SlashCommandBuilder()
		.setName(commandName)
		.setDescription(
			"Log a game of Pickleball."
		),

	async execute(interaction) {
        // Immediately send a reply
        await interaction.reply({ content: "Loading..." });

        // Get all members in the guild
        const members = interaction.guild.members.cache;
        // Filter out anyone without the Pickler role
        const players = members//.filter(member => member.roles.cache.has(PicklerRoleID));
        
        const fetchedMembers = await interaction.guild.members.fetch();

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

		await interaction.editReply({ content: 'test!', components: [row] });
	},
};

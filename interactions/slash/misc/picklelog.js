
const { MessageEmbed, Collection } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageActionRow, MessageSelectMenu } = require('discord.js');
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
            playerOptions.push( {
                label: member.displayName + " (" + member.user.username + ")",
                description: 'Maybe their career stats here?',
                value: member.id,
            });
        });

        const row = new MessageActionRow().addComponents(
            new MessageSelectMenu()
                .setCustomId('select')
                .setPlaceholder('Select a player.')
                .addOptions(playerOptions)
        );

		await interaction.reply({ content: 'test!', components: [row] });
	},
};

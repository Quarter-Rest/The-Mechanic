module.exports = {
	data: {
		name: "userBlows",
		type: 2, // 2 is for user context menus
	},

	/**
	 * @param {import("discord.js").ContextMenuInteraction} interaction The Interaction Object of the command.
	 */

	async execute(interaction) {
		await interaction.reply({
			content: interaction.user.username + " BLOWS! :muscle:",
		});
		return;
	},
};

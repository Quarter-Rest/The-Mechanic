module.exports = {
	data: {
		name: "messageBlows",
		type: 3, // 3 is for message context menus
	},

	/**
	 * @param {import("discord.js").ContextMenuInteraction} interaction The Interaction Object of the command.
	 */

	async execute(interaction) {
		await interaction.reply({
			content: `THIS MESSAGE BLOWS! :muscle:`,
		});
		return;
	},
};

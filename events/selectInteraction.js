/**
 * @file Select Menu Interaction Handler
 * @author Naman Vrati
 * @since 3.0.0
 */

module.exports = {
	name: "interactionCreate",

	/**
	 * @description Executes when an interaction is created and handle it.
	 * @author Naman Vrati
	 * @param {import("discord.js").SelectMenuInteraction} interaction The interaction which was created
	 */

	async execute(interaction) {
		// // Deconstructed client from interaction object.
		const { client } = interaction;

		// Checks if the interaction is a select menu interaction (to prevent weird bugs)

		if (!interaction.isStringSelectMenu()) return;
		/**
		 * @description The Interaction command object
		 * @type {import("discord.js").SelectMenuInteraction}
		 */

		const command = client.selectCommands.get(interaction.customId);

		// If the interaction is not a command in cache, return error message.
		// You can modify the error message at ./messages/defaultSelectError.js file!

		if (!command) {
			//console.log(interaction)
			//await require("../messages/defaultSelectError").execute(interaction);
			return;
		}

		// A try to execute the interaction.

		try {
			await command.execute(interaction);
			return;
		} catch (err) {
			console.error(err);
			await interaction.reply({
				content: "There was an issue while executing that select menu option!",
				ephemeral: true,
			});
			return;
		}
	},
};

module.exports = {
	id: "d4",

	async execute(interaction) {
		var roll = Math.floor(Math.random() * 4) + 1;
		await interaction.reply({
			content: interaction.user.username + " rolled a D4 and got a **" + String(roll) + "**!",
		});
		return;
	},
};

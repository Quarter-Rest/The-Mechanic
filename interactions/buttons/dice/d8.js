module.exports = {
	id: "d8",

	async execute(interaction) {
		var roll = Math.floor(Math.random() * 8) + 1;
		await interaction.reply({
			content: interaction.user.username + " rolled a D8 and got a **" + String(roll) + "**!",
		});
		return;
	},
};

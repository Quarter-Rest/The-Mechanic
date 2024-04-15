module.exports = {
	id: "d20",

	async execute(interaction) {
		var roll = Math.floor(Math.random() * 20) + 1;
		await interaction.reply({
			content: interaction.user.username + " rolled a D20 and got a **" + String(roll) + "**!",
		});
		return;
	},
};

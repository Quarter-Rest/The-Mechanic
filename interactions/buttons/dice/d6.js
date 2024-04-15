module.exports = {
	id: "d6",

	async execute(interaction) {
		var roll = Math.floor(Math.random() * 6) + 1;
		await interaction.reply({
			content: interaction.user.username + " rolled a D6 and got a **" + String(roll) + "**!",
		});
		return;
	},
};

module.exports = {
	id: "heads",

	async execute(interaction) {
		var flip = Math.floor(Math.random() * 2);
        var wOrL = '';
        if(flip == 1) {
            wOrL = '**won**'
        }
        else {
            wOrL = '**lost**'
        }
		await interaction.reply({
			content: interaction.user.username + " selected heads against " + interaction.member.username + ' and ' + wOrL + '!',
		});
		return;
	},
};

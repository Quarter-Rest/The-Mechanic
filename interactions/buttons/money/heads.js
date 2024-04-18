module.exports = {
	id: "heads",

	async execute(interaction) {
		var flip = Math.floor(Math.random());
        var wOrL = '';
        if(flip == 0) {
            wOrL = '**won**'
        }
        else {
            wOrL = '**lost**'
        }
		await interaction.reply({
			content: interaction.user.username + " selected heads against " + 'user' + ' and ' + wOrL + '!',
		});
		return;
	},
};

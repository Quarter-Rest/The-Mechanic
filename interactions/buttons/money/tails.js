module.exports = {
	id: "tails",

	async execute(interaction) {
		var flip = Math.floor(Math.random());
        var wOrL = '';
        if(flip == 0) {
            wOrL = '**lost**'
        }
        else {
            wOrL = '**won**'
        }
		await interaction.reply({
			content: interaction.user.username + " selected tails against " + 'user' + ' and ' + wOrL + '!',
		});
		return;
	},
};

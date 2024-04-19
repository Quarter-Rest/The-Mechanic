module.exports = {
    id: "tails",

    async execute(interaction) {
        var flip = Math.floor(Math.random() * 2);
        var wOrL = '';
        if(flip == 1) {
            wOrL = '**lost**'
        }
        else {
            wOrL = '**won**'
        }
        await interaction.followUp({
			content: interaction.user.username + " selected tails against " + interaction.creator + ' and ' + wOrL + '!',
            components: [] // This removes the buttons
        });
        global.overflowData = '';
        return;
    },
};
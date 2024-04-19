module.exports = {
    id: "heads",

    async execute(interaction) {
        console.log(interaction + ' /// ' + interaction.creator);
        var flip = Math.floor(Math.random() * 2);
        var wOrL = '';
        if(flip == 1) {
            wOrL = '**won**'
        }
        else {
            wOrL = '**lost**'
        }
        await interaction.update({
            content: interaction.user.username + " selected heads against " + interaction.creator + ' and ' + wOrL + '!',
            components: [] // This removes the buttons
        });
        global.overflowData = '';
        return;
    },
};
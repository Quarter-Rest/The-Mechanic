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

        const creatorId = global.interactionMap.get(interaction.message.interaction.id);
        global.interactionMap.delete(interaction.message.interaction.id);

        await interaction.update({
            content: interaction.user.username + " selected heads against " + creatorId.username + ' and ' + wOrL + '!',
            components: [] // This removes the buttons
        });
        return;
    },
};
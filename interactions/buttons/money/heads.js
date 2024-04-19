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

        const message = await interaction.channel.messages.fetch(interaction.message.id);
        const creatorId = global.interactionMap.get(interaction.id); // Retrieve the user's ID
        global.interactionMap.delete(interaction.id); // Remove the user's ID from the map

        await interaction.update({
            content: interaction.user.username + " selected heads against " + creatorId.username + ' and ' + wOrL + '!',
            components: [] // This removes the buttons
        });
        return;
    },
};
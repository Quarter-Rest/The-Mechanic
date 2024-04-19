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

        //const message = await interaction.channel.messages.fetch(interaction.message);
        const creatorId = global.interactionMap.get(interaction.id); // Retrieve the user's ID
        //console.log(global.interactionMap);
        global.interactionMap.delete(interaction.message); // Remove the user's ID from the map
        //console.log(global.interactionMap);

        await interaction.update({
            content: interaction.user.username + " selected heads against " + creatorId + ' and ' + wOrL + '!',
            components: [] // This removes the buttons
        });
        return;
    },
};
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

        //var msg = await interaction.update({});
        const creatorId = 'TEST'; // Retrieve the user's ID
        console.log(interaction);
        //global.interactionMap.delete(msg.id); // Remove the user's ID from the map

        await interaction.update({
            content: interaction.user.username + " selected heads against " + creatorId + ' and ' + wOrL + '!',
            components: [] // This removes the buttons
        });
        return;
    },
};
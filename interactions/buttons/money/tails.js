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

        var msg = await interaction.update({});
        const creatorId = global.interactionMap.get(msg.id); // Retrieve the user's ID
        global.interactionMap.delete(msg.id); // Remove the user's ID from the map

        await interaction.update({
			content: interaction.user.username + " selected tails against " + creatorId + ' and ' + wOrL + '!',
            components: [] // This removes the buttons
        });
        return;
    },
};
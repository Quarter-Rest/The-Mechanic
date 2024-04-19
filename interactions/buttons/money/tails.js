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

        const message = await interaction.channel.messages.fetch(interaction.message.id);

        await interaction.update({
			content: interaction.user.username + " selected tails against " + message.author + ' and ' + wOrL + '!',
            components: [] // This removes the buttons
        });
        return;
    },
};
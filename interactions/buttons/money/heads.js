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

        const message = await interaction.channel.messages.fetch(interaction.message.id);

        await interaction.update({
            content: interaction.user.username + " selected heads against " + message.author + ' and ' + wOrL + '!',
            components: [] // This removes the buttons
        });
        return;
    },
};
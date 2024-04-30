module.exports = {
    id: "heads",

    async execute(interaction) {
        var creatorId = global.interactionMap.get(interaction.message.interaction.id);
        var wager = global.interactionMap.get(interaction.message.interaction.id + 'W');
        global.interactionMap.delete(interaction.message.interaction.id);
        global.interactionMap.delete(interaction.message.interaction.id + 'W');

        var flip = Math.floor(Math.random() * 2);
        var wOrL = '';
        if(flip == 1) {
            wOrL = '**won**'
            await ChangeMoney(creatorId.id, -wager);
            await ChangeMoney(interaction.user.id, wager);
        }
        else {
            wOrL = '**lost**'
            await ChangeMoney(creatorId.id, wager);
            await ChangeMoney(interaction.user.id, -wager);
        }

        //interaction.user og

        await interaction.update({
            content: interaction.user.username + " selected heads against " + creatorId.username + ' and ' + wOrL + '!',
            components: [] // This removes the buttons
        });
        return;
    },
};

async function ChangeMoney(id, money) {
    const userId = id;
    const query = `UPDATE MONEY SET MONEY = MONEY + ? WHERE ID = ?`;

    return new Promise((resolve, reject) => {
        con.query(query, [money, userId], (err, result) => {
            if (err) {
                console.error("Error updating data:", err);
                reject(err);
            }
      
            if (result.affectedRows === 0) {
                console.log("No data found for user:", userId);
                reject("No data found");
            }
      
            resolve(`Balance changed for user ${userId}`);
        });
    });
}
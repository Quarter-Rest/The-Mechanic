const mon = require('../../money');

module.exports = {
    id: "tails",

    async execute(interaction) {
        //Make sure account is valid.
        await mon.GetMoney(interaction);

        var creatorId = global.interactionMap.get(interaction.message.interaction.id);
        var wager = global.interactionMap.get(interaction.message.interaction.id + 'W');
        global.interactionMap.delete(interaction.message.interaction.id);
        global.interactionMap.delete(interaction.message.interaction.id + 'W');

        var flip = Math.floor(Math.random() * 2);
        var wOrL = '';
        if(flip == 1) {
            wOrL = '**lost**'
            await AddMoney(creatorId.id, wager);
            await AddMoney(interaction.user.id, -wager);
        }
        else {
            wOrL = '**won**'
            await AddMoney(creatorId.id, -wager);
            await AddMoney(interaction.user.id, wager);
        }

        await interaction.update({
            content: interaction.user.username + " selected tails against " + creatorId.username + ' and ' + wOrL + ' ' + wager + ' Frodecoins!',
            components: [] // This removes the buttons.
        });
        return;
    },
};

async function AddMoney(id, money) {
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
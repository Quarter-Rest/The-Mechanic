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

async function ChangeMoney(id, wager) {
    const userId = id;
    let query = `SELECT MONEY FROM MONEY WHERE ID = ?`;
  
    return new Promise((resolve, reject) => {
        con.query(query, [userId], (err, rows) => {
            if (err) {
                console.error("Error fetching data:", err);
                reject(err);
            }
      
            if (rows.length === 0) {
                console.log("No data found for user:", userId);
                const insert = `INSERT INTO MONEY (ID, NICKNAME, MONEY, SHARES) VALUES (?, ?, ?, 0)`;
                con.query(insert, [userId, interaction.member.username, wager], (err, result) => {
                    if (err) {
                        console.error("Error inserting data:", err);
                        reject(err);
                    } else {
                        resolve(wager);
                    }
                });
            } else {
                let newMoney = rows[0].MONEY + wager;
                let updateQuery = `UPDATE MONEY SET MONEY = ? WHERE ID = ?`;
                con.query(updateQuery, [newMoney, userId], (err, result) => {
                    if (err) {
                        console.error("Error updating data:", err);
                        reject(err);
                    } else {
                        resolve(newMoney);
                    }
                });
            }
        });
    });
}
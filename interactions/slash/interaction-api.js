
async function CheckUserInDatabase(userId, tableName) {
    let query = `SELECT EXISTS(SELECT * FROM ? WHERE ID = ?)`;

    return new Promise((resolve, reject) => {
        con.query(query, [tableName, userId], (err, result) => {
            if (err) {
                console.error("Error fetching data:", err);
                reject(err);
            }
      
            // Check if user exists in the database
            if (!result[0]) {
                console.log("No data found for user:", userId);
                
                // Insert user into the table
                const insert = `INSERT INTO ${tableName} (ID, NICKNAME) VALUES (?, ?)`;
                con.query(insert, [userId, interaction.user.username], (err, result) => {
                    if (err) {
                        console.error("Error inserting data:", err);
                        reject(err);
                    } else {
                        console.log("User inserted successfully:", userId);
                        resolve();
                    }
                });
            } else {
                console.log("User already exists:", userId);
                resolve();
            }
        });
    });
}
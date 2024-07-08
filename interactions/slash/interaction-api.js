
class InteractionAPI {
	
	// Will make sure the given user ID is in a table. 
	// It will add them if not so long as the table follows the format: (ID, NICKNAME, ...)
	static async CheckUserInTable(userId, tableName) {
		let query = `SELECT EXISTS(SELECT * FROM ${tableName} WHERE ID = ?)`;

		return new Promise((resolve, reject) => {
			con.query(query, [userId], (err, result) => {
				if (err) {
					console.error("Error fetching data:", err);
					reject(err);
				}

				console.log("Results: " + result)
		
				// Check if user exists in the table
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

};

module.exports = {InteractionAPI}
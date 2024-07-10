
const { test_guild_id } = require("./config.json");

class InteractionAPI {
	
	// Will make sure the given user ID is in a table. 
	// It will add them if not so long as the table follows the format: (ID, NICKNAME, ...)
	static async CheckUserInTable(userId, tableName) {
		let query = `SELECT * FROM ${tableName} WHERE ID = ?`;

		return new Promise((resolve, reject) => {
			con.query(query, [userId], (err, result) => {
				if (err) {
					console.error("Error fetching data:", err);
					reject(err);
				}
				
				// Check if user exists in the table
				if (!result[0]) {
					console.log("No data found for user:", userId);

					const userNickname = global.client.users.fetch(userId).username
					console.log("nickanme: " + userNickname)
					
					// Insert user into the table
					const insert = `INSERT INTO ${tableName} (ID, NICKNAME) VALUES (?, ?)`;
					con.query(insert, [userId, userNickname], (err, result) => {
						if (err) {
							console.error("Error inserting data:", err);
							reject(err);
						} else {
							console.log("User inserted successfully:", userId);
							resolve();
						}
					});
				} else {
					//console.log("User already exists:", userId);
					resolve();
				}
			});
		});
	}

	static async SetValueInTable(userId, tableName, valueName, value) {
		const query = `UPDATE ${tableName} SET ${valueName} = ? WHERE ID = ?`;

		return new Promise((resolve, reject) => {
			con.query(query, [value, userId], (err, result) => {
				if (err) {
					console.error("Error updating data:", err);
					reject(err);
				}
		
				if (result.affectedRows === 0) {
					console.log("No data found for user:", userId);
					reject("No data found");
				}
		
				resolve();
			});
		});
	}

	static async GetValueInTable(userId, tableName, valueName) {
		const query = `SELECT ${valueName} FROM ${tableName} WHERE ID = ?`;

		return new Promise((resolve, reject) => {
			con.query(query, [userId], (err, result) => {
				if (err) {
					console.error("Error updating data:", err);
					reject(err);
				}
		
				if (result.affectedRows === 0) {
					console.log("No data found for user:", userId);
					reject("No data found");
				}
		
				resolve(result);
			});
		});
	}

	static async GetRowInTable(userId, tableName) {
		const query = `SELECT * FROM ${tableName} WHERE ID = ?`;

		return new Promise((resolve, reject) => {
			con.query(query, [userId], (err, result) => {
				if (err) {
					console.error("Error updating data:", err);
					reject(err);
				}
		
				if (result.affectedRows === 0) {
					console.log("No data found for user:", userId);
					reject("No data found");
				}
		
				resolve(result[0]);
			});
		});
	}

	static async GetTable(userId, tableName) {
		const query = `SELECT * FROM ${tableName}`;

		return new Promise((resolve, reject) => {
			con.query(query, [], (err, result) => {
				if (err) {
					console.error("Error updating data:", err);
					reject(err);
				}
		
				if (result.affectedRows === 0) {
					console.log("No data found for user:", userId);
					reject("No data found");
				}
		
				resolve(result[0]);
			});
		});
	}

};

module.exports = {InteractionAPI}

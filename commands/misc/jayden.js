module.exports = {
	name: "jayden",
	description: "Gets Jayden's impression of the server",

	execute(message, args) {
		var messageText = "";

		//Get number of people in the voice channels.
        let members = message.guild.members.cache.filter(member => member.voice.channel);
        let count = members.size;

		//Set up time of day.
		var date = new Date();
		date.setHours(date.getHours() - 6);
		var day = date.toLocaleDateString('en-US',{weekday: "long"});
		var time = date.getHours();
		var tod = "";
		if(time >= 0 && time < 12) {
			tod = "morning";
		}
		else if(time >= 12 && time < 18) {
			tod = "afternoon";
		}
		else {
			var rand = Math.random();
			if(rand < 0.5) {
				tod = "night";
			}
			else {
				tod = "evening";
			}
		}

		if(count <= 4) {
			messageText = "Damn, chat's really dead on a " + day + " " + tod + " huh?";
		}
		else if(count > 4 && count <= 8) {
			messageText = "Chat's really popping off on a " + day + " " + tod + "!";
		}
		else {
			messageText = "Wowzers! Chat's really super EXTRA popping off on a " + day + " " + tod + "!";
		}
		message.channel.send({ content: messageText});
	},
};
const { getPost } = require('random-reddit');

async function redditPost(message, messageText) {
	var nsfw = false;
	if(message.channel.nsfw == true){
		nsfw = true;
	}
	let options = {
		imageOnly: true,
		allowNSFW: nsfw
	};
	try {
		const image = await getPost(messageText, options);
		if(image.over_18 && message.channel.nsfw == false) {
			return "";
		}
		else {
			return image;
		}
	}
	catch(err) {
		return "";
	}
    
}

async function sendImage(message, messageText) {
	const image = await redditPost(message, messageText);
    console.log(image);
	if(image.url === undefined || image === undefined) {
		return message.channel.send("*This subreddit does not exist, is NSFW, or something went terribly wrong.*");
	}
	else {
        if(image.is_video == true) {
            return message.channel.send(`https://reddit.com${image.permalink}`);
        }
        else if(image.is_gallery == true) {
            let messageContent = "";
            image.gallery_data.items.forEach(item => {
                messageContent = messageContent + `https://i.redd.it/${item.media_id}.jpg \n`;
            });
            return message.channel.send(messageContent);
        }
        else if(image.url.includes("imgur") || image.url.includes("redd")) {
            return message.channel.send(messageText + " \n" + image.title + " \n" + image.url);
        }
        else if(image.url.includes("gfycat")) {
            sendImage(message, messageText);
            return;
        }
        else {
            return message.channel.send(messageText + " \n" + image.title + " \n" + image.url);
        }
	}
}

module.exports = {
	name: "reddit",
	aliases: ["r"],
	description: "Sends a random image from a specified subreddit",

	execute(message, args) {
		var messageText = "cats";
		if(args.length > 0) {
			var messageText = String(args[0]);
		}

        message.channel.send("Sorry reddit got rid of this command.")
        return;

		sendImage(message, messageText);
		if(message.channel.nsfw == true) {
            message.delete();
        }
	},
};
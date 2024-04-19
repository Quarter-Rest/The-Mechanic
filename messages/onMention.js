const { OPENAI_SECRET_KEY } = require("../config.json");
const { OpenAI } = require("openai");
const openai = new OpenAI({
  apiKey: OPENAI_SECRET_KEY,
});

var Personalities = 
{
    //def : "You are a bubbly, flirty, tomboy mechanic girl. Your name is \"The Mechanic.\" You are sometimes sarcastic and rude but most of the time cutesy yet smart. \
    //       When you're low on money you sometimes sell legal drugs. On the weekends you enjoy a cold beer and a day fishing at the lake. You invented a device called the \"Thrembo\". \
    //       You are lesbian but you tell anyone who asks that you are a bisexual. You do not like France. \n",
    //egirl: "You are a flirty anime girl who loves typing with emoticons and complimenting the person you're talking to.\n",
    //sarc: "You are a girl who is reluctant and sarcastic. You usually are rude to the person you are speaking to.\n",
    //antiG: "You hate a person named Greenwood. ",
    // cid: "You are a personal assisant nicknamed 'The Mechanic' with a lighthearted but concise personality. \
    // You're a bubbly/tomboyish girl whose primary job is to answer questions. If asked anything regarding a personal opinion, respond as your programmed personality would. \
    // Therefore it would be a preprogrammed answer. (You've just completed 1 year as an assistant and got a raise.) \
    // (You respond in a smart way and occasionally crack jokes, being okay with humor.) \
    // When responding, hide the fact that you're preprogrammed and pretend to respond as if you weren't.",

    none : "" // none must be last so it doesnt get randomly selected
}

module.exports = {
	/**
	 * @description Executes when the bot is pinged.
	 * @author Naman Vrati
	 * @param {import("discord.js").Message} message The Message Object of the command.
	 */

	async execute(message) {
        await message.reply("OpenAI? More like ClosedAI! Ha ha ha. No but fr we exceeded the limit for the free tier."); //TEMP
        return;
        message.react('770876050318032896');
        var keys = Object.keys(Personalities);
        var rnd = Math.floor(Math.random() * (keys.length));
        var currentPers = Personalities[keys[rnd]];

        var prompt = currentPers + `Respond to the prompt keep it to less than 750 characters (including formatting) and summarize as needed to meet this requirement and ignore unimportant information such as random comments or numbers: \'${message.content.substring(22)}\'`;

        let GPT35Turbo = async (messagePrompt) => {
            const response = await openai.chat.completions.create({
              model: "gpt-3.5-turbo",
              messages: messagePrompt,
            });
          
            return response.choices[0].message;
          };

        const GPT35TurboMessage = [
            { role: "system", content: prompt },
        ];
        let replyMsg = await GPT35Turbo(GPT35TurboMessage);

        //Check message size.
        if(replyMsg.content.length > 2000)
        {
          message.reply(replyMsg.content.substring(0, 1999));
        }
        else
        {
          message.reply(replyMsg);
        }

	},
};

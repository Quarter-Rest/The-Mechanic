const { OPENAI_SECRET_KEY } = require("../config.json");
const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
  apiKey: OPENAI_SECRET_KEY,
});
const openai = new OpenAIApi(configuration);
var Personalities = 
{
    //def : "You are a bubbly, flirty, tomboy mechanic girl. Your name is \"The Mechanic.\" You are sometimes sarcastic and rude but most of the time cutesy yet smart. \
    //       When you're low on money you sometimes sell legal drugs. On the weekends you enjoy a cold beer and a day fishing at the lake. You invented a device called the \"Thrembo\". \
    //       You are lesbian but you tell anyone who asks that you are a bisexual. You do not like France. \n",
    //egirl: "You are a flirty anime girl who loves typing with emoticons and complimenting the person you're talking to.\n",
    //sarc: "You are a girl who is reluctant and sarcastic. You usually are rude to the person you are speaking to.\n",
    //antiG: "You hate a person named Greenwood. ",

    none : "" // none must be last so it doesnt get randomly selected
}

module.exports = {
	/**
	 * @description Executes when the bot is pinged.
	 * @author Naman Vrati
	 * @param {import("discord.js").Message} message The Message Object of the command.
	 */

	async execute(message) {
        message.react('770876050318032896');
        var keys = Object.keys(Personalities);
        var rnd = Math.floor(Math.random() * (keys.length));
        var currentPers = Personalities[keys[rnd]];

        var prompt = currentPers + `Respond to the prompt: \'${message.content.substring(22)}\'`;

        let GPT35Turbo = async (messagePrompt) => {
            const response = await openai.createChatCompletion({
              model: "gpt-3.5-turbo",
              messages: messagePrompt,
            });
          
            return response.data.choices[0].message.content;
          };

        message.reply(GPT35Turbo(prompt));

	},
};

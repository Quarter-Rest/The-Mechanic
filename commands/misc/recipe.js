const { OPENAI_SECRET_KEY } = require("../../config.json");
const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
  apiKey: OPENAI_SECRET_KEY,
});
const openai = new OpenAIApi(configuration);

module.exports = {
	name: "recipe",

	/** You need to uncomment below properties if you need them. */
	//description: 'Ping!',
	//usage: 'put usage here',
	//permissions: 'SEND_MESSAGES',
	//guildOnly: true,

	execute(message, args) {
        message.react('770876050318032896');
        console.log(message.content);
		var prompt = `List a recipe on how to make  \'${message.content}\'`;
        (async () => {
            const gptResponse = await openai.createCompletion({
                model: "text-davinci-003",
                prompt: prompt,
                temperature: 0.6,
                max_tokens: 512,
              });


            message.reply(`${gptResponse.data.choices[0].text}`);

        })();
	},
};

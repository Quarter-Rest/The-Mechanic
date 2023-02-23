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
		var prompt = `List a recipe on how to make \'${message.content.substring(("~recipe ").length)}\' but list the ingredients with a leading | and an ending |.`;
        (async () => {
            const gptResponse = await openai.createCompletion({
                model: "text-davinci-003",
                prompt: prompt,
                temperature: 0.6,
                max_tokens: 512,
              });

            let response = gptResponse.data.choices[0].text;
            message.reply(response);
            let ingredients = getIngredients(response);
            let nextResponse = "You can find those ingredients at these links."

            await Promise.all(ingredients.map(async ingredient => {
                let item = await fetchItem(ingredient);
                nextResponse = nextResponse.concat(item.link)
              }));
            message.reply(nextResponse);
        })();
	},
};

function getIngredients(inputArr) {
    // Split the input string by '|' to get each ingredient as a separate string
    const ingredientsStrings = inputArr.split('|').map(str => str.trim());
  
    // Remove any empty strings from the array
    const ingredients = ingredientsStrings.filter(str => str !== '');
  
    return ingredients;
  }

const axios = require("axios");
const cheerio = require("cheerio");

const fetchItem = async (name) => {
   try {
       const response = await axios.get(`https://www.amazon.com/s?crid=36QNR0DBY6M7J&k=${name}&ref=glow_cls&refresh=1&sprefix=s%2Caps%2C309`);

       const html = response.data;

       const $ = cheerio.load(html);

       //const items = [];

 $('div.sg-col-4-of-12.s-result-item.s-asin.sg-col-4-of-16.sg-col.sg-col-4-of-20').each((_idx, el) => {
            const item = $(el)
            const title = item.find('span.a-size-base-plus.a-color-base.a-text-normal').text()

            const image = item.find('img.s-image').attr('src')

            const link = item.find('a.a-link-normal.a-text-normal').attr('href').toString()

            const reviews = item.find('div.a-section.a-spacing-none.a-spacing-top-micro > div.a-row.a-size-small').children('span').last().attr('aria-label')

            const stars = item.find('div.a-section.a-spacing-none.a-spacing-top-micro > div > span').attr('aria-label')

            const price = item.find('span.a-price > span.a-offscreen').text()


                let element = {
                    title,
                    image,
                    link: `https://amazon.com${link}`,
                    price,
                }

                if (reviews) {
                    element.reviews = reviews
                }

                if (stars) {
                    element.stars = stars
                }
            console.log(element);
           return element; // push back here for array
       });

       //return item;
   } catch (error) {
       throw error;
   }
};
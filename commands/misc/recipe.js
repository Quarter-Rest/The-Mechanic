const { OPENAI_SECRET_KEY } = require("../../config.json");
const { OpenAI } = require("openai");
const openai = new OpenAI({
  apiKey: OPENAI_SECRET_KEY,
});


module.exports = {
	name: "recipe",

	/** You need to uncomment below properties if you need them. */
	//description: 'Ping!',
	//usage: 'put usage here',
	//permissions: 'SEND_MESSAGES',
	//guildOnly: true,

	execute(message, args) {
        message.react('770876050318032896');

		var prompt = `Give me a recipe on how to make \'${message.content.substring(("~recipe ").length)}\' but list the ingredients with a leading | and an ending |. Only use up to 5 ingredients keep it to less than 1000 characters (including formatting) and summarize as needed to meet this requirement and ignore unimportant information such as random comments or numbers:.`;
        (async () => {

            // get ingrdients from a juicy llm
            const logicResponse = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                prompt: prompt,
                temperature: 0.1,
                max_tokens: 256,
              });
            console.log(`\n${logicResponse.data.choices[0].text}\n`)
            let ingredients = getIngredients(logicResponse.data.choices[0].text);

            // get a nicer response for the client
            prompt = `Tell me how to make \'${message.content.substring(("~recipe ").length)}\' using these ingreients: ${ingredients.join()}.`
            const niceResponse = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                prompt: prompt,
                temperature: 0.6,
                max_tokens: 256,
              });
            message.reply(niceResponse.data.choices[0].text);
            let nextResponse = "You can find those ingredients at these links."

            let item = await fetchItem(ingredients[0]);
            nextResponse = nextResponse.concat(item.link).concat("\n");
            message.reply(nextResponse);
        })();
	},
};

function getIngredients(input) {
    const regex = /\|([^|]+)\|/g; // Matches any text between two | characters
    const matches = input.match(regex); // Returns an array of all matches
  
    if (matches === null) {
      return [];
    }
  
    // Use map to extract the text between the | characters from each match
    const ingredients = matches.map(match => match.slice(1, -1));
    console.log("Ingrediate:")
    console.log(ingredients);
    return ingredients;
  }
const axios = require("axios");
const cheerio = require("cheerio");

const fetchItem = async (name) => {
   try {
       const response = await axios.get(`https://www.amazon.com/s?k=${name}`);

       const html = response.data;

       const $ = cheerio.load(html);

       //const items = [];

       $('div.sg-col-4-of-12.s-result-item.s-asin.sg-col-4-of-16.sg-col.sg-col-4-of-20').each((_idx, el) => {
        if(_idx > 1) return;
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
const fs = require('node:fs');
const path = require('node:path');
const { randomInt, randomUUID } = require('node:crypto');
const { SlashCommandBuilder } = require('discord.js');

const directory = path.join(__dirname, '..', 'commands', 'generated');
const namePattern = /^[a-z0-9]{1,32}$/;
const fileSuffix = '.command.json';
const filePattern = /^[a-z0-9]{1,32}\.command\.json$/;
const optionMethods = new Map([
    ['string', ['addStringOption', 'getString']],
    ['integer', ['addIntegerOption', 'getInteger']],
    ['number', ['addNumberOption', 'getNumber']],
    ['boolean', ['addBooleanOption', 'getBoolean']],
]);
const templatePattern = /\{\{(roll|option:([a-z0-9]{1,32}))\}\}/g;
const allowedMentions = { parse: [], repliedUser: false };

function checkFields(value, fields, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`${label} must be an object`);
    }
    if (Object.keys(value).some(key => !fields.includes(key))) {
        throw new Error(`${label} contains unsupported fields`);
    }
}

function checkText(value, maxLength, label) {
    if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
        throw new Error(`${label} must be text between 1 and ${maxLength} characters`);
    }
}

function compile(definition, expectedName) {
    checkFields(definition, ['name', 'description', 'options', 'reply', 'roll'], 'Command definition');
    const { name, description, options = [], reply, roll } = definition;
    if (!namePattern.test(expectedName) || name !== expectedName) {
        throw new Error(`The command name must be ${expectedName}`);
    }
    checkText(description, 100, 'Description');
    if (!Array.isArray(options) || options.length > 25) {
        throw new Error('Options must be an array of at most 25 items');
    }
    if (roll !== undefined && (!Number.isInteger(roll) || roll < 2 || roll > 10000)) {
        throw new Error('Roll must be an integer between 2 and 10000');
    }

    const data = new SlashCommandBuilder().setName(name).setDescription(description);
    const getters = new Map();
    for (const option of options) {
        checkFields(option, ['name', 'description', 'type', 'required'], 'Option');
        if (typeof option.name !== 'string' || !namePattern.test(option.name) || getters.has(option.name)) {
            throw new Error('Option names must be unique and use 1 to 32 lowercase letters or digits');
        }
        checkText(option.description, 100, 'Option description');
        if (!optionMethods.has(option.type)) {
            throw new Error('Options must use string, integer, number, or boolean');
        }
        if (option.required !== undefined && typeof option.required !== 'boolean') {
            throw new Error('Option required must be a boolean');
        }

        const [builder, getter] = optionMethods.get(option.type);
        data[builder](input => input.setName(option.name).setDescription(option.description).setRequired(option.required ?? false));
        getters.set(option.name, getter);
    }

    const replies = Array.isArray(reply) ? reply : [reply];
    if (!replies.length || replies.length > 25) {
        throw new Error('Provide between 1 and 25 replies');
    }
    for (const template of replies) {
        checkText(template, 2000, 'Reply');
        const remainder = template.replace(templatePattern, (_, token, optionName) => {
            if (token === 'roll' ? roll === undefined : !getters.has(optionName)) {
                throw new Error(`Reply uses an undefined placeholder: ${token}`);
            }
            return '';
        });
        if (remainder.includes('{{') || remainder.includes('}}')) {
            throw new Error('Reply contains an unsupported placeholder');
        }
    }

    // Verify that Discord's builder can serialize the command before saving or registering it.
    data.toJSON();
    return {
        data,
        generated: true,
        async execute(interaction) {
            const template = replies[randomInt(replies.length)];
            const result = roll === undefined ? null : randomInt(1, roll + 1);
            const rendered = template.replace(templatePattern, (_, token, optionName) => {
                if (token === 'roll') return String(result);
                const getter = getters.get(optionName);
                return String(interaction.options[getter](optionName) ?? '');
            });
            const content = rendered.replace(/<@&(?=\d+>)/g, '<@\u200b&').slice(0, 2000);
            await interaction.reply({ content: content.trim() ? content : 'No text provided.', allowedMentions });
        },
    };
}

function load(filePath) {
    return compile(JSON.parse(fs.readFileSync(filePath, 'utf8')), path.basename(filePath, fileSuffix));
}

function save(definition) {
    const { name } = definition;
    const temporaryFile = path.join(directory, `${randomUUID()}.tmp`);
    fs.writeFileSync(temporaryFile, JSON.stringify(definition, null, 4) + '\n', { flag: 'wx' });
    try {
        fs.renameSync(temporaryFile, path.join(directory, `${name}${fileSuffix}`));
    } finally {
        fs.rmSync(temporaryFile, { force: true });
    }
}

module.exports = { directory, fileSuffix, filePattern, compile, load, save };

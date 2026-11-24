const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const generatedCommands = require('../services/generatedCommands');
const { createChatCompletion, hasApiKey } = require('../services/openrouter');

const activeGenerations = new Set();
const maxAttempts = 3;
const unsupportedMessage = 'Generated commands can only send replies. Moderation, role operations, and changes to members, channels, or the server are unavailable.';
const systemPrompt = `Create a JSON definition for a reply-only Discord slash command. Output one JSON object.
Use these fields:
- "name": the exact command name requested.
- "description": a short string up to 100 characters.
- "reply": a nonempty string up to 2000 characters, or an array of up to 25 such strings to pick from at random.
- Optional "options": up to 25 objects with "name" (lowercase ASCII letters or digits), "description" (up to 100 characters), "type" ("string", "integer", "number", or "boolean"), and optional "required" (boolean). Place required options first. Use {{option:name}} to insert an option value in a reply.
- Optional "roll": an integer from 2 to 10000. Use {{roll}} in the reply for a random integer between 1 and that number.

Generate replies for things like facts, jokes, random choices, dice rolls and echoing user input.
If the request involves kicking, banning, timing out, changing nicknames or other names, managing or reading roles or permissions, deleting messages, invoking other commands, external APIs, or any operation that the fields above cannot perform, return {"unsupported":true}. Do not make a reply that pretends to perform the requested operation. Do not output JavaScript, markdown, or extra fields.`;

async function generateDefinition(name, request, existingDefinition) {
    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify({ name, request, existingDefinition }) },
    ];

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const output = await createChatCompletion(messages, { maxTokens: 4096 });
        try {
            const json = output.replace(/^```(?:json)?\s*|\s*```$/gi, '');
            const definition = JSON.parse(json);
            if (definition?.unsupported === true) return null;
            generatedCommands.compile(definition, name);
            return definition;
        } catch (error) {
            if (attempt === maxAttempts) throw error;
            messages.push(
                { role: 'assistant', content: output },
                { role: 'user', content: `The definition failed validation: ${error.message}. Return a corrected JSON definition or {"unsupported":true}.` },
            );
        }
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('proompt')
        .setDescription('Generate a reply-only command using AI')
        .setDefaultMemberPermissions(PermissionFlagsBits.ViewAuditLog)
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Name for the new command (lowercase, no spaces)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('request')
                .setDescription('Describe what you want the command to reply with')
                .setRequired(true)),

    async execute(interaction) {
        const name = interaction.options.getString('name', true).toLowerCase().replace(/[^a-z0-9]/g, '');
        const request = interaction.options.getString('request', true);

        if (!name || name.length > 32) {
            return interaction.reply({ content: 'Use 1 to 32 letters or numbers for the command name.', ephemeral: true });
        }

        const currentCommand = interaction.client.commands.get(name);
        if (currentCommand && !currentCommand.generated) {
            return interaction.reply({ content: `\`/${name}\` is a built-in command.`, ephemeral: true });
        }
        if (!hasApiKey()) {
            return interaction.reply({ content: 'AI generation is not configured. Missing OpenRouter API key.', ephemeral: true });
        }
        if (activeGenerations.has(name)) {
            return interaction.reply({ content: `\`/${name}\` is already being generated.`, ephemeral: true });
        }

        activeGenerations.add(name);
        try {
            await interaction.deferReply();
            const filePath = path.join(generatedCommands.directory, `${name}${generatedCommands.fileSuffix}`);
            const isUpdate = fs.existsSync(filePath);
            const existingDefinition = isUpdate ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : undefined;
            const definition = await generateDefinition(name, request, existingDefinition);
            if (!definition) {
                await interaction.editReply(unsupportedMessage);
                return;
            }

            generatedCommands.save(definition);
            await interaction.editReply(`${isUpdate ? 'Updated' : 'Created'} \`/${name}\`. It will be available after Discord refreshes the command list.`);
        } catch (error) {
            console.error('[Proompt] Generation failed:', error);
            await interaction.editReply('Could not generate a valid reply-only command.').catch(() => {});
        } finally {
            activeGenerations.delete(name);
        }
    },
};

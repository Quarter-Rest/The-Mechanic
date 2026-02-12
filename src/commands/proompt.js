const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// Load Bonsai API key from secrets
let bonsaiKey = null;
try {
    const secrets = require('../../secrets.json');
    bonsaiKey = secrets.bonsai?.api_key;
} catch (e) {
    console.warn('[Proompt] Could not load Bonsai API key from secrets.json');
}

const SYSTEM_PROMPT = `You are a Discord.js v14 command generator. Generate ONLY the JavaScript code for a Discord slash command file.

Requirements:
- Use SlashCommandBuilder from discord.js
- Export an object with 'data' and 'execute' properties
- The execute function receives an 'interaction' parameter
- Use modern Discord.js v14 patterns
- Include appropriate options if the user's request implies parameters
- Keep the code clean and functional
- Do NOT include any explanation, markdown, or comments outside the code
- Output ONLY valid JavaScript code that can be directly saved to a .js file

Example structure:
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('commandname')
        .setDescription('Description'),

    async execute(interaction) {
        // Implementation
    },
};`;

/**
 * Generate command code using Anthropic API via Bonsai
 * @param {string} commandName - Name for the command
 * @param {string} userRequest - What the user wants the command to do
 * @returns {Promise<string>} Generated code
 */
async function generateWithClaude(commandName, userRequest) {
    if (!bonsaiKey) {
        throw new Error('Bonsai API key not configured in secrets.json');
    }

    const body = JSON.stringify({
        model: 'anthropic/claude-sonnet-4.5',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Say hello' }]
    });

    // Try every header combination
    const attempts = [
        { name: 'bearer+version', headers: { 'Authorization': `Bearer ${bonsaiKey}`, 'anthropic-version': '2023-06-01' } },
        { name: 'bearer-only', headers: { 'Authorization': `Bearer ${bonsaiKey}` } },
        { name: 'xapi+version', headers: { 'x-api-key': bonsaiKey, 'anthropic-version': '2023-06-01' } },
        { name: 'xapi-only', headers: { 'x-api-key': bonsaiKey } },
    ];

    for (const attempt of attempts) {
        const response = await fetch('https://go.trybons.ai/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...attempt.headers },
            body
        });

        const text = await response.text();
        console.log(`[Proompt] ${attempt.name}: ${response.status} ${text.substring(0, 200)}`);

        if (response.ok) {
            console.log('[Proompt] Found working config:', attempt.name);
            // Now do the real generation request with same headers
            const realBody = JSON.stringify({
                model: 'anthropic/claude-sonnet-4.5',
                max_tokens: 4096,
                messages: [{
                    role: 'user',
                    content: `${SYSTEM_PROMPT}\n\nGenerate a Discord.js v14 slash command with:\n- Name: "${commandName}"\n- Functionality: ${userRequest}\n\nOutput only the JavaScript code:`
                }]
            });

            const realResponse = await fetch('https://go.trybons.ai/v1/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...attempt.headers },
                body: realBody
            });

            if (!realResponse.ok) {
                const errText = await realResponse.text();
                throw new Error(`Bonsai API error: ${errText}`);
            }

            const message = await realResponse.json();
            const output = message.content
                .filter(block => block.type === 'text')
                .map(block => block.text)
                .join('');

            let cleanCode = output.trim();
            cleanCode = cleanCode.replace(/^```(?:javascript|js)?\n?/i, '');
            cleanCode = cleanCode.replace(/\n?```$/i, '');
            return cleanCode.trim();
        }
    }

    throw new Error('All Bonsai API attempts failed. Check logs.');
}

/**
 * Validate that generated code has required exports
 * @param {string} code - Generated JavaScript code
 * @returns {boolean}
 */
function validateCommand(code) {
    return code.includes('module.exports') &&
           code.includes('data') &&
           code.includes('execute') &&
           code.includes('SlashCommandBuilder');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('proompt')
        .setDescription('Generate a new command using AI')
        .setDefaultMemberPermissions(PermissionFlagsBits.ViewAuditLog)
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Name for the new command (lowercase, no spaces)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('request')
                .setDescription('Describe what you want the command to do')
                .setRequired(true)),

    async execute(interaction) {
        const name = interaction.options.getString('name').toLowerCase().replace(/[^a-z0-9]/g, '');
        const request = interaction.options.getString('request');

        if (!name) {
            return interaction.reply({ content: 'Invalid command name. Use only letters and numbers.', ephemeral: true });
        }

        if (name.length > 32) {
            return interaction.reply({ content: 'Command name must be 32 characters or less.', ephemeral: true });
        }

        if (!bonsaiKey) {
            return interaction.reply({ content: 'AI generation is not configured. Missing Bonsai API key.', ephemeral: true });
        }

        const generatedPath = path.join(__dirname, 'generated');

        // Ensure generated folder exists
        if (!fs.existsSync(generatedPath)) {
            fs.mkdirSync(generatedPath, { recursive: true });
        }

        const filePath = path.join(generatedPath, `${name}.js`);

        // Check if command already exists
        if (fs.existsSync(filePath)) {
            return interaction.reply({ content: `Command \`/${name}\` already exists!`, ephemeral: true });
        }

        await interaction.deferReply();

        try {
            await interaction.editReply(`Generating \`/${name}\` command...`);

            const generatedCode = await generateWithClaude(name, request);

            // Validate the generated code
            if (!validateCommand(generatedCode)) {
                await interaction.editReply({
                    content: `Failed to generate valid command code. The AI output didn't match the expected format. Please try again with a clearer description.`
                });
                return;
            }

            // Write the command file
            fs.writeFileSync(filePath, generatedCode);

            await interaction.editReply({
                content: `Created command \`/${name}\`\n\n**Request:** ${request}\n\nThe command will be available in a few seconds after hot reload registers it.`
            });

        } catch (error) {
            console.error('[Proompt] Generation failed:', error.status, error.message);
            if (error.error) console.error('[Proompt] Error body:', JSON.stringify(error.error));
            await interaction.editReply({
                content: `Failed to generate command: ${error.message}`
            });
        }
    },
};

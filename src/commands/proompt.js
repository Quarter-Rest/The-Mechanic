const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Load OpenRouter API key from secrets
let openrouterKey = null;
try {
    const secrets = require('../../secrets.json');
    openrouterKey = secrets.openrouter?.api_key;
} catch (e) {
    console.warn('[Proompt] Could not load OpenRouter API key from secrets.json');
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
 * Call OpenRouter and return the cleaned code string.
 * @param {Array} messages - Chat messages to send
 * @returns {Promise<string>} Cleaned code
 */
async function callOpenRouter(messages) {
    if (!openrouterKey) {
        throw new Error('OpenRouter API key not configured in secrets.json');
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openrouterKey}`
        },
        body: JSON.stringify({
            model: 'openrouter/free',
            max_tokens: 4096,
            messages
        })
    });

    const responseText = await response.text();

    if (!response.ok) {
        console.error('[Proompt] OpenRouter API error:', response.status, responseText);
        throw new Error(`OpenRouter API error ${response.status}: ${responseText}`);
    }

    const data = JSON.parse(responseText);
    const output = data.choices?.[0]?.message?.content;

    if (!output) {
        throw new Error('AI returned an empty response');
    }

    // Clean up the output - remove any markdown code blocks if present
    let cleanCode = output.trim();
    cleanCode = cleanCode.replace(/^```(?:javascript|js)?\n?/i, '');
    cleanCode = cleanCode.replace(/\n?```$/i, '');
    return cleanCode.trim();
}

const MAX_ATTEMPTS = 3;

/**
 * Generate command code using OpenRouter API with a validate-and-retry loop.
 * @param {string} commandName - Name for the command
 * @param {string} userRequest - What the user wants the command to do
 * @param {function} [onRetry] - Optional callback(attempt, error) for progress updates
 * @returns {Promise<string>} Validated generated code
 */
async function generateWithAI(commandName, userRequest, onRetry) {
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
            role: 'user',
            content: `Generate a Discord.js v14 slash command with:\n- Name: "${commandName}"\n- Functionality: ${userRequest}\n\nOutput only the JavaScript code:`
        }
    ];

    let lastError = null;
    let lastCode = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        // On retry, append the error so the AI can fix it
        if (lastError) {
            if (onRetry) onRetry(attempt, lastError);
            messages.push(
                { role: 'assistant', content: '```js\n' + lastCode + '\n```' },
                {
                    role: 'user',
                    content: `That code failed validation with this error:\n${lastError}\n\nPlease fix the code and output ONLY the corrected JavaScript. Make sure the command name is exactly "${commandName}".`
                }
            );
        }

        const code = await callOpenRouter(messages);

        lastCode = code;
        const result = validateAndTest(code, commandName);

        if (result.valid) {
            if (attempt > 1) {
                console.log(`[Proompt] Code passed validation on attempt ${attempt}`);
            }
            return code;
        }

        console.warn(`[Proompt] Attempt ${attempt}/${MAX_ATTEMPTS} failed validation: ${result.error}`);
        lastError = result.error;
    }

    throw new Error(`Generated code failed validation after ${MAX_ATTEMPTS} attempts. Last error: ${lastError}`);
}

/**
 * Validate generated command code by parsing and loading it in isolation.
 * @param {string} code - Generated JavaScript code
 * @param {string} commandName - Expected slash-command name
 * @returns {{ valid: boolean, error?: string }}
 */
function validateAndTest(code, commandName) {
    // Stage 1 — Syntax check (parse without executing)
    try {
        new vm.Script(code, { filename: 'generated-command.js' });
    } catch (err) {
        return { valid: false, error: `Syntax error: ${err.message}` };
    }

    // Stage 2 — Structural check (require in a temp file)
    // Write temp file inside the project so require() can resolve node_modules
    const tmpFile = path.join(__dirname, `_proompt-validate-${Date.now()}-${Math.random().toString(36).slice(2)}.js`);
    try {
        fs.writeFileSync(tmpFile, code);

        // Clear any stale cache for the temp path
        delete require.cache[require.resolve(tmpFile)];

        const mod = require(tmpFile);

        if (!mod || typeof mod !== 'object') {
            return { valid: false, error: 'module.exports is not an object' };
        }
        if (!('data' in mod)) {
            return { valid: false, error: 'module.exports is missing the "data" property' };
        }
        if (!('execute' in mod)) {
            return { valid: false, error: 'module.exports is missing the "execute" property' };
        }
        if (typeof mod.execute !== 'function') {
            return { valid: false, error: '"execute" is not a function' };
        }
        if (typeof mod.data?.toJSON !== 'function') {
            return { valid: false, error: '"data" is not a SlashCommandBuilder (missing .toJSON())' };
        }

        // Verify toJSON() doesn't throw
        let json;
        try {
            json = mod.data.toJSON();
        } catch (err) {
            return { valid: false, error: `data.toJSON() threw: ${err.message}` };
        }

        // Verify the command name matches what was requested
        if (json.name !== commandName) {
            return { valid: false, error: `Command name mismatch: expected "${commandName}", got "${json.name}"` };
        }

        return { valid: true };
    } catch (err) {
        return { valid: false, error: `Failed to load module: ${err.message}` };
    } finally {
        // Clean up temp file and require cache
        try { delete require.cache[require.resolve(tmpFile)]; } catch {}
        try { fs.unlinkSync(tmpFile); } catch {}
    }
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

        if (!openrouterKey) {
            return interaction.reply({ content: 'AI generation is not configured. Missing OpenRouter API key.', ephemeral: true });
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

            const generatedCode = await generateWithAI(name, request, (attempt, error) => {
                interaction.editReply(`Generating \`/${name}\` command... (attempt ${attempt}/${MAX_ATTEMPTS}, fixing: ${error})`).catch(() => {});
            });

            // Write the command file
            fs.writeFileSync(filePath, generatedCode);

            await interaction.editReply({
                content: `Created command \`/${name}\`\n\n**Request:** ${request}\n\nThe command will be available in a few seconds after hot reload registers it.`
            });

        } catch (error) {
            console.error('[Proompt] Generation failed:', error);
            await interaction.editReply({
                content: `Failed to generate command: ${error.message}`
            });
        }
    },
};

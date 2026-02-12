const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');

let client = null;
let rest = null;
let clientId = null;
let guildId = null;
let registrationTimeout = null;

const DEBOUNCE_MS = 2000; // Wait 2 seconds after last change before registering

/**
 * Initialize the hot reload system
 * @param {Client} discordClient - The Discord.js client
 * @param {string} token - Bot token for REST API
 * @param {string} applicationId - Discord application/client ID
 * @param {string} testGuildId - Guild ID for command registration
 */
function init(discordClient, token, applicationId, testGuildId) {
    client = discordClient;
    rest = new REST().setToken(token);
    clientId = applicationId;
    guildId = testGuildId;
}

/**
 * Load a command from a file path
 * @param {string} filePath - Absolute path to the command file
 * @returns {object|null} The command module or null if invalid
 */
function loadCommand(filePath) {
    // Clear require cache to get fresh version
    delete require.cache[require.resolve(filePath)];

    try {
        const command = require(filePath);

        if ('data' in command && 'execute' in command) {
            return command;
        } else {
            console.warn(`[HotReload] Command at ${filePath} missing required "data" or "execute" property`);
            return null;
        }
    } catch (error) {
        console.error(`[HotReload] Failed to load ${filePath}:`, error.message);
        return null;
    }
}

/**
 * Unload a command by filename
 * @param {string} fileName - The command filename (e.g., 'ping.js')
 */
function unloadCommand(fileName) {
    const commandsPath = path.join(__dirname, 'commands');
    const filePath = path.join(commandsPath, fileName);

    // Find and remove the command from collection
    for (const [name, cmd] of client.commands) {
        // Check if this command came from the file being removed
        const cmdPath = path.join(commandsPath, fileName);
        if (require.cache[cmdPath] && require.cache[cmdPath].exports === cmd) {
            client.commands.delete(name);
            console.log(`[HotReload] Unloaded command: ${name}`);
            break;
        }
    }

    // Clear from require cache
    delete require.cache[require.resolve(filePath)];
}

/**
 * Schedule command registration with Discord API (debounced)
 */
function scheduleRegistration() {
    if (registrationTimeout) {
        clearTimeout(registrationTimeout);
    }

    registrationTimeout = setTimeout(async () => {
        await registerCommands();
    }, DEBOUNCE_MS);
}

/**
 * Register all current commands with Discord
 */
async function registerCommands() {
    const commands = [];

    for (const [name, command] of client.commands) {
        commands.push(command.data.toJSON());
    }

    try {
        console.log(`[HotReload] Registering ${commands.length} commands with Discord...`);
        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands }
        );
        console.log(`[HotReload] Successfully registered ${commands.length} commands`);
    } catch (error) {
        console.error('[HotReload] Failed to register commands:', error);
    }
}

/**
 * Handle a file change event
 * @param {string} eventType - 'rename' or 'change'
 * @param {string} fileName - The filename that changed
 */
function handleFileChange(eventType, fileName) {
    if (!fileName || !fileName.endsWith('.js')) return;

    const commandsPath = path.join(__dirname, 'commands');
    const filePath = path.join(commandsPath, fileName);

    // Check if file exists (to distinguish add/modify from delete)
    const fileExists = fs.existsSync(filePath);

    if (fileExists) {
        // File was added or modified
        const command = loadCommand(filePath);

        if (command) {
            // Remove old version if it exists (for modifications)
            if (client.commands.has(command.data.name)) {
                console.log(`[HotReload] Reloading command: ${command.data.name}`);
            } else {
                console.log(`[HotReload] Loading new command: ${command.data.name}`);
            }

            client.commands.set(command.data.name, command);
            scheduleRegistration();
        }
    } else {
        // File was deleted - find and remove the command
        // We need to check which command was in this file
        for (const [name, cmd] of client.commands) {
            // Try to match by checking the cache
            const cachedPath = require.resolve(filePath).replace(/\\/g, '/');
            for (const [cachePath, cached] of Object.entries(require.cache)) {
                if (cachePath.replace(/\\/g, '/').endsWith(fileName) && cached.exports === cmd) {
                    client.commands.delete(name);
                    delete require.cache[cachePath];
                    console.log(`[HotReload] Removed command: ${name}`);
                    scheduleRegistration();
                    return;
                }
            }
        }
    }
}

/**
 * Start watching the commands directory for changes
 */
function startWatching() {
    const commandsPath = path.join(__dirname, 'commands');

    console.log(`[HotReload] Watching ${commandsPath} for changes...`);

    // Use fs.watch for file system events
    const watcher = fs.watch(commandsPath, { persistent: true }, (eventType, fileName) => {
        // Debounce rapid events (some systems fire multiple events per change)
        handleFileChange(eventType, fileName);
    });

    watcher.on('error', (error) => {
        console.error('[HotReload] Watcher error:', error);
    });

    return watcher;
}

module.exports = {
    init,
    startWatching,
    loadCommand,
    registerCommands
};

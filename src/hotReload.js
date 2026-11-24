const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');
const generatedCommands = require('./services/generatedCommands');
const { getConfig } = require('./config');

const commandsPath = path.join(__dirname, 'commands');
const subcommandsDirectory = 'subcommands';

let client = null;
let rest = null;
let clientId = null;
let guildId = null;
let registrationTimeout = null;

function init(discordClient, token, applicationId, testGuildId) {
    client = discordClient;
    rest = new REST().setToken(token);
    clientId = applicationId;
    guildId = testGuildId;
}

function loadBuiltInCommand(filePath) {
    const previous = require.cache[filePath];
    delete require.cache[filePath];
    if (path.basename(filePath) === 'index.js') {
        const subcommandsPath = path.join(path.dirname(filePath), subcommandsDirectory) + path.sep;
        for (const cachedPath of Object.keys(require.cache)) {
            if (cachedPath.startsWith(subcommandsPath)) delete require.cache[cachedPath];
        }
    }

    try {
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            return command;
        }
        console.warn(`[HotReload] Command at ${filePath} missing required "data" or "execute" property`);
    } catch (error) {
        console.error(`[HotReload] Failed to load ${filePath}:`, error.message);
    }
    if (previous) require.cache[filePath] = previous;
    return null;
}

function loadGeneratedCommand(commands, filePath) {
    const name = path.basename(filePath, generatedCommands.fileSuffix);
    const current = commands.get(name);
    if (current && !current.generated) {
        console.warn(`[HotReload] Skipping generated /${name} because it matches a built-in command`);
        return;
    }

    try {
        if (fs.lstatSync(filePath, { throwIfNoEntry: false })?.isFile()) {
            commands.set(name, generatedCommands.load(filePath));
            console.log(`[HotReload] Loaded generated command: ${name}`);
            return;
        }
    } catch (error) {
        console.error(`[HotReload] Skipping invalid generated command /${name}:`, error.message);
    }
    commands.delete(name);
}

function getBuiltInCommandFiles(dir) {
    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.name === 'node_modules' || fullPath === generatedCommands.directory) continue;
        if (entry.isDirectory()) {
            if (entry.name !== subcommandsDirectory) files.push(...getBuiltInCommandFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            files.push(fullPath);
        }
    }
    return files;
}

function loadCommands() {
    const commands = new Map();
    for (const filePath of getBuiltInCommandFiles(commandsPath)) {
        const command = loadBuiltInCommand(filePath);
        if (command) {
            commands.set(command.data.name, command);
            console.log(`[HotReload] Loaded command: ${command.data.name}`);
        }
    }

    let entries;
    try {
        entries = fs.readdirSync(generatedCommands.directory, { withFileTypes: true });
    } catch (error) {
        if (error.code === 'ENOENT') return commands;
        throw error;
    }
    for (const entry of entries) {
        if (entry.isFile() && generatedCommands.filePattern.test(entry.name)) {
            loadGeneratedCommand(commands, path.join(generatedCommands.directory, entry.name));
        }
    }
    return commands;
}

function scheduleRegistration() {
    const debounceMs = Math.max(100, Number(getConfig().hotReload?.debounceMs) || 2000);
    clearTimeout(registrationTimeout);
    registrationTimeout = setTimeout(registerCommands, debounceMs);
}

async function registerCommands() {
    try {
        const commands = Array.from(client.commands.values(), command => command.data.toJSON());
        console.log(`[HotReload] Registering ${commands.length} commands with Discord...`);
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
        console.log(`[HotReload] Successfully registered ${commands.length} commands`);
    } catch (error) {
        console.error('[HotReload] Failed to register commands:', error);
    }
}

function reloadAll() {
    client.commands = loadCommands();
    scheduleRegistration();
    return client.commands.size;
}

function handleBuiltInFileChange(filePath, isFile) {
    if (!filePath.endsWith('.js')) return;

    const previous = require.cache[filePath]?.exports;
    const command = isFile ? loadBuiltInCommand(filePath) : null;
    if (isFile && !command) return;
    if (previous && client.commands.get(previous.data?.name) === previous) {
        client.commands.delete(previous.data.name);
    }
    if (command) {
        client.commands.set(command.data.name, command);
        console.log(`[HotReload] Loaded command: ${command.data.name}`);
    } else {
        delete require.cache[filePath];
    }
    if (previous || command) scheduleRegistration();
}

function reloadCommandDirectory(dir) {
    const filePath = path.join(dir, 'index.js');
    handleBuiltInFileChange(filePath, fs.lstatSync(filePath, { throwIfNoEntry: false })?.isFile());
}

function closeDirectoryWatchers(dir, watchers) {
    if (!watchers.has(dir)) return;

    for (const [watchedDir, watcher] of watchers) {
        if (watchedDir === dir || watchedDir.startsWith(dir + path.sep)) {
            watchers.delete(watchedDir);
            watcher.close();
        }
    }
}

function watchDirectory(dir, watchers) {
    if (watchers.has(dir)) return;

    const isGenerated = dir === generatedCommands.directory;
    const isSubcommands = path.basename(dir) === subcommandsDirectory;
    const watcher = fs.watch(dir, { persistent: true }, (_, fileName) => {
        if (!fileName || fileName === 'node_modules') return;

        const filePath = path.join(dir, fileName);
        if (isGenerated) {
            if (generatedCommands.filePattern.test(fileName)) {
                loadGeneratedCommand(client.commands, filePath);
                scheduleRegistration();
            }
            return;
        }
        if (isSubcommands) {
            if (fileName.endsWith('.js')) reloadCommandDirectory(path.dirname(dir));
            return;
        }

        const stats = fs.lstatSync(filePath, { throwIfNoEntry: false });
        if (!stats) closeDirectoryWatchers(filePath, watchers);
        if (stats?.isDirectory()) {
            watchDirectory(filePath, watchers);
            if (filePath !== generatedCommands.directory) {
                reloadCommandDirectory(fileName === subcommandsDirectory ? dir : filePath);
            }
        } else if (filePath !== generatedCommands.directory) {
            if (fileName === subcommandsDirectory) {
                reloadCommandDirectory(dir);
            } else if (!stats && require.cache[path.join(filePath, 'index.js')]) {
                reloadCommandDirectory(filePath);
            } else {
                handleBuiltInFileChange(filePath, stats?.isFile());
            }
        }
    });

    watcher.on('error', error => console.error(`[HotReload] Watcher error for ${dir}:`, error));
    watcher.on('close', () => {
        if (watchers.get(dir) === watcher) watchers.delete(dir);
    });
    watchers.set(dir, watcher);

    if (isGenerated || isSubcommands) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory() && entry.name !== 'node_modules') {
            watchDirectory(path.join(dir, entry.name), watchers);
        }
    }
}

function startWatching() {
    fs.mkdirSync(generatedCommands.directory, { recursive: true });
    const watchers = new Map();
    console.log(`[HotReload] Watching ${commandsPath} (including subdirectories) for changes...`);
    watchDirectory(commandsPath, watchers);
    return watchers;
}

module.exports = { init, startWatching, registerCommands, reloadAll, loadCommands };

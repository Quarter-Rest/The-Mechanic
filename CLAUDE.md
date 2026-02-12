# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Discord bot ("The Mechanic") built with Discord.js v14, using MySQL for data persistence. Hosted on SparkdHost via Pterodactyl.

## Commands

```bash
npm start              # Run the bot (node src/index.js)
npm run deploy         # Register slash commands manually (usually not needed - auto-registers on startup)
```

## Architecture

**Entry Point**: `src/index.js` - Initializes Discord client, loads commands from `src/commands/`, registers them on startup, and handles interactions.

**Command Loading**: On startup, `index.js` reads all `.js` files from `src/commands/`, validates they have `data` and `execute` properties, and auto-registers them with Discord's guild commands API.

**Database**: `src/database.js` exports `connect(config)` and `getConnection()`. Uses mysql2 with auto-reconnect on connection loss.

## Adding Commands

Create a file in `src/commands/` following this pattern:

```js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('commandname')
        .setDescription('Description here'),

    async execute(interaction) {
        // Command logic
    },
};
```

Commands are auto-loaded and registered when the bot starts. The hot reload system (`src/hotReload.js`) watches for changes - new/modified/deleted command files are automatically detected, loaded, and re-registered with Discord without restarting.

## Configuration

- `config.json` (git-ignored): Bot token, client_id, test_guild_id, MySQL config
- `secrets.json` (git-ignored): Pterodactyl API credentials for server management

## Deployment

The production server auto-pulls from `main` on start. See `AGENTS.md` for Pterodactyl API commands to restart the server and read crash logs.

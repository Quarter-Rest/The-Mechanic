# Agent Guidelines for The Mechanic

## Project Overview

Discord bot built with Discord.js v14. Modern slash commands only.

## Code Conventions

### Discord.js

- **Version**: 14.x (see [discord.js guide](https://discordjs.guide/))
- **Slash commands only** - No prefix commands (`!help`, `!ping`, etc.)
- Use modern Discord features: slash commands, buttons, modals, select menus
- Commands go in `src/commands/` following the existing pattern
- Entry point: `src/index.js`

### Command Structure

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

### Database

- MySQL2 for database connections
- Connection module: `src/database.js`
- Access via `require('./database').getConnection()`
- Config stored in `config.json` (git-ignored)

## Git Workflow

- Remote: `git@github.com:Quarter-Rest/The-Mechanic.git` (SSH)
- Push to `main` branch
- Server auto-pulls on start

## DevOps - SparkdHost (Pterodactyl)

API credentials stored in `secrets.json` (git-ignored):

```json
{
  "sparkedhost": {
    "api_key": "...",
    "server_id": "c1f604c6"
  }
}
```

### Restart Server

```bash
curl -s -X POST "https://control.sparkedhost.us/api/client/servers/c1f604c6/power" \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"signal": "restart"}'
```

### Start Server

```bash
curl -s -X POST "https://control.sparkedhost.us/api/client/servers/c1f604c6/power" \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"signal": "start"}'
```

### Check Server Status

```bash
curl -s "https://control.sparkedhost.us/api/client/servers/c1f604c6/resources" \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Accept: application/json"
```

Returns `current_state`: `running`, `starting`, `stopping`, or `offline`.

### Limitations

- Console logs require WebSocket (not available via REST API)
- User must check panel for startup errors

## Deployment Workflow

1. Make changes locally
2. Test if possible
3. Commit and push to `main`
4. Read API key from `secrets.json`
5. Restart server via Pterodactyl API
6. Check status to confirm it's running

## Files

| File | Purpose |
|------|---------|
| `src/index.js` | Bot entry point |
| `src/database.js` | MySQL connection |
| `src/deploy-commands.js` | Register slash commands with Discord |
| `src/commands/*.js` | Slash command files |
| `config.json` | Bot token, client ID, MySQL config (git-ignored) |
| `secrets.json` | Pterodactyl API key (git-ignored) |

# Agent Guidelines for The Mechanic

## Project Overview

Discord bot built with Discord.js v14.
Deployment target is a single guild only.

## Code Conventions

### Discord.js

- **Version**: 14.x (see [discord.js guide](https://discordjs.guide/))
- Prefer modern interactions: slash commands, buttons, modals, select menus, context menus
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

### Permissions

- Use `PermissionFlagsBits.ViewAuditLog` for moderator-level commands (not Administrator)
- ViewAuditLog represents "moderator" access in this bot

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
  },
  "openrouter": {
    "api_key": "..."
  }
}
```

- The `/proompt` command uses OpenRouter (https://openrouter.ai) for AI code generation
- Uses `openrouter/free` model (auto-routes to best available free model)

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

### Read Crash Logs

```bash
# List crash logs
curl -s "https://control.sparkedhost.us/api/client/servers/c1f604c6/files/list?directory=/.apollo/crashes" \
  -H "Authorization: Bearer <API_KEY>" -H "Accept: application/json"

# Read specific crash log (URL encode the filename)
curl -s "https://control.sparkedhost.us/api/client/servers/c1f604c6/files/contents?file=%2F.apollo%2Fcrashes%2F<filename>" \
  -H "Authorization: Bearer <API_KEY>" -H "Accept: application/json"
```

### File Operations

```bash
# List files
curl -s "https://control.sparkedhost.us/api/client/servers/c1f604c6/files/list?directory=/" \
  -H "Authorization: Bearer <API_KEY>" -H "Accept: application/json"

# Delete files/folders
curl -s -X POST "https://control.sparkedhost.us/api/client/servers/c1f604c6/files/delete" \
  -H "Authorization: Bearer <API_KEY>" -H "Content-Type: application/json" \
  -d '{"root": "/", "files": ["node_modules"]}'

# Write file
curl -s -X POST "https://control.sparkedhost.us/api/client/servers/c1f604c6/files/write?file=%2Fpath%2Fto%2Ffile.js" \
  -H "Authorization: Bearer <API_KEY>" -H "Content-Type: text/plain" \
  --data-binary @localfile.js

# Rename file
curl -s -X PUT "https://control.sparkedhost.us/api/client/servers/c1f604c6/files/rename" \
  -H "Authorization: Bearer <API_KEY>" -H "Content-Type: application/json" \
  -d '{"root": "/", "files": [{"from": "old.json", "to": "new.json"}]}'
```

### Limitations

- Live console requires WebSocket (not available via REST API)
- Use crash logs at `/.apollo/crashes/` for debugging startup errors

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

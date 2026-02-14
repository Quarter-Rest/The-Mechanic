const path = require('node:path');
const { promisify } = require('node:util');
const { execFile } = require('node:child_process');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getConfig, refreshConfig } = require('../config');
const conversationContextStore = require('../services/conversationContextStore');
const styleContextStore = require('../services/styleContextStore');

const execFileAsync = promisify(execFile);

function compactText(value, maxLength = 700) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) {
        return '(none)';
    }
    return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

async function runGit(args, timeoutMs) {
    const result = await execFileAsync('git', args, {
        cwd: path.join(__dirname, '..', '..'),
        timeout: timeoutMs,
        windowsHide: true,
    });

    return {
        stdout: String(result.stdout || ''),
        stderr: String(result.stderr || ''),
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('refreshconfig')
        .setDescription('Pull latest git changes and refresh runtime config')
        .setDefaultMemberPermissions(PermissionFlagsBits.ViewAuditLog),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const devopsConfig = getConfig().devops || {};
            const timeoutMs = Math.max(5000, Number(devopsConfig.gitPullTimeoutMs) || 60000);
            const remote = String(devopsConfig.gitPullRemote || 'origin');

            const branchInfo = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], timeoutMs);
            const branch = compactText(branchInfo.stdout, 80);

            const pullResult = await runGit(['pull', '--ff-only', remote, branch], timeoutMs);
            refreshConfig();
            conversationContextStore.reconfigure();
            styleContextStore.reconfigure();

            const stdout = compactText(pullResult.stdout);
            const stderr = compactText(pullResult.stderr);

            await interaction.editReply(
                `Config refreshed.\n` +
                `Branch: \`${branch}\`\n` +
                `Git stdout: \`${stdout}\`\n` +
                `Git stderr: \`${stderr}\``
            );
        } catch (error) {
            console.error('[RefreshConfig] Error:', error);
            await interaction.editReply(`Failed to refresh config: ${error.message}`);
        }
    },
};

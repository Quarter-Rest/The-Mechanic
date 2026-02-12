const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { builtinModules } = require('node:module');

const projectRoot = path.resolve(__dirname, '..', '..');
const generatedCommandsDir = path.resolve(projectRoot, 'src', 'commands', 'generated');
const installAttemptTimestamps = new Map();
const INSTALL_RETRY_COOLDOWN_MS = 30000;

function getMissingModuleSpecifier(error) {
    if (!error || error.code !== 'MODULE_NOT_FOUND') {
        return null;
    }

    const message = String(error.message || '');
    const match = message.match(/Cannot find module ['"]([^'"]+)['"]/);
    return match ? match[1] : null;
}

function extractPackageName(specifier) {
    if (!specifier || typeof specifier !== 'string') {
        return null;
    }

    if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('node:')) {
        return null;
    }

    if (path.isAbsolute(specifier)) {
        return null;
    }

    const normalized = specifier.replace(/\\/g, '/');
    if (!normalized) {
        return null;
    }

    let packageName;
    if (normalized.startsWith('@')) {
        const parts = normalized.split('/');
        if (parts.length < 2) {
            return null;
        }
        packageName = `${parts[0]}/${parts[1]}`;
    } else {
        packageName = normalized.split('/')[0];
    }

    if (!packageName || !/^(?:@[\w.-]+\/)?[\w.-]+$/.test(packageName)) {
        return null;
    }

    if (builtinModules.includes(packageName) || builtinModules.includes(`node:${packageName}`)) {
        return null;
    }

    return packageName;
}

function isGeneratedCommandSource(sourceFile) {
    if (!sourceFile) {
        return false;
    }
    const normalizedSource = path.resolve(sourceFile);
    return normalizedSource.startsWith(`${generatedCommandsDir}${path.sep}`);
}

function shouldAttemptInstall(packageName) {
    const now = Date.now();
    const lastAttempt = installAttemptTimestamps.get(packageName) || 0;
    if (now - lastAttempt < INSTALL_RETRY_COOLDOWN_MS) {
        return false;
    }
    installAttemptTimestamps.set(packageName, now);
    return true;
}

function installPackage(packageName, contextLabel = 'Runtime') {
    if (!shouldAttemptInstall(packageName)) {
        console.warn(`[${contextLabel}] Skipping reinstall for "${packageName}" (cooldown active)`);
        return false;
    }

    console.log(`[${contextLabel}] Installing missing package "${packageName}"...`);
    const result = spawnSync('npm', ['install', '--save', packageName], {
        cwd: projectRoot,
        stdio: 'pipe',
        encoding: 'utf8',
    });

    if (result.status !== 0) {
        const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
        console.error(`[${contextLabel}] Failed to install "${packageName}"${details ? `:\n${details}` : ''}`);
        return false;
    }

    console.log(`[${contextLabel}] Installed "${packageName}" successfully`);
    return true;
}

function installFromModuleNotFound(error, options = {}) {
    const contextLabel = options.contextLabel || 'Runtime';
    const generatedOnly = options.generatedOnly !== false;
    const sourceFile = options.sourceFile || null;

    if (generatedOnly && !isGeneratedCommandSource(sourceFile)) {
        return false;
    }

    const specifier = getMissingModuleSpecifier(error);
    const packageName = extractPackageName(specifier);
    if (!packageName) {
        return false;
    }

    return installPackage(packageName, contextLabel);
}

module.exports = {
    installFromModuleNotFound,
};

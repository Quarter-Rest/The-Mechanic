function truncate(text, maxLength) {
    if (typeof text !== 'string') {
        return '';
    }
    if (text.length <= maxLength) {
        return text;
    }
    return `${text.slice(0, maxLength - 3)}...`;
}

function pickRequestUrl(error) {
    const configUrl = error?.config?.url;
    if (typeof configUrl === 'string' && configUrl) {
        return configUrl;
    }

    const currentUrl = error?.request?._currentUrl;
    if (typeof currentUrl === 'string' && currentUrl) {
        return currentUrl;
    }

    return '';
}

function pickRequestMethod(error) {
    const configMethod = error?.config?.method;
    if (typeof configMethod === 'string' && configMethod) {
        return configMethod.toUpperCase();
    }

    const requestMethod = error?.request?._options?.method;
    if (typeof requestMethod === 'string' && requestMethod) {
        return requestMethod.toUpperCase();
    }

    return '';
}

function formatErrorForAI(error, maxLength = 7000) {
    if (!error) {
        return 'Unknown runtime error';
    }

    if (typeof error === 'string') {
        return truncate(error, maxLength);
    }

    if (typeof error !== 'object') {
        return truncate(String(error), maxLength);
    }

    const lines = [];
    const name = error.name || error.constructor?.name;
    if (name) lines.push(`name: ${name}`);
    if (typeof error.message === 'string' && error.message) lines.push(`message: ${error.message}`);
    if (typeof error.code === 'string' && error.code) lines.push(`code: ${error.code}`);
    if (error.errno !== undefined) lines.push(`errno: ${error.errno}`);
    if (typeof error.syscall === 'string' && error.syscall) lines.push(`syscall: ${error.syscall}`);
    if (typeof error.hostname === 'string' && error.hostname) lines.push(`hostname: ${error.hostname}`);

    const method = pickRequestMethod(error);
    const url = pickRequestUrl(error);
    if (method || url) {
        lines.push(`request: ${(method || 'REQUEST')} ${url || '(unknown url)'}`.trim());
    }

    const status = error?.response?.status;
    if (status !== undefined) lines.push(`response_status: ${status}`);

    if (typeof error?.cause?.message === 'string' && error.cause.message) {
        lines.push(`cause: ${error.cause.message}`);
    }

    if (typeof error.stack === 'string' && error.stack) {
        const stackPreview = error.stack.split('\n').slice(0, 25).join('\n');
        lines.push(`stack:\n${stackPreview}`);
    }

    if (!lines.length) {
        return truncate(String(error), maxLength);
    }

    return truncate(lines.join('\n'), maxLength);
}

function formatErrorForUser(error, maxLength = 220) {
    const fallback = 'Unexpected command error';
    if (!error) {
        return fallback;
    }

    if (typeof error === 'string') {
        return truncate(error, maxLength) || fallback;
    }

    if (typeof error !== 'object') {
        return truncate(String(error), maxLength) || fallback;
    }

    const message = typeof error.message === 'string' && error.message ? error.message : '';
    const cause = typeof error?.cause?.message === 'string' ? error.cause.message : '';
    const userText = message || cause || fallback;
    return truncate(userText.replace(/\s+/g, ' ').trim(), maxLength) || fallback;
}

module.exports = {
    formatErrorForAI,
    formatErrorForUser,
};

/**
 * Sanitize string input by removing potentially harmful characters
 */
export function sanitizeString(input) {
    if (typeof input !== 'string')
        return '';
    return input.trim().replace(/[^a-zA-Z0-9_.-]/g, '');
}
/**
 * Validate webhook payload structure
 */
export function validateWebhookPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        return { isValid: false, error: 'Invalid webhook payload structure' };
    }
    const webhook = payload;
    if (!webhook.repository) {
        return { isValid: false, error: 'Repository information missing from webhook payload' };
    }
    if (!webhook.pullrequest) {
        return { isValid: false, error: 'Pull request information missing from webhook payload' };
    }
    const repository = webhook.repository;
    const pullrequest = webhook.pullrequest;
    // Validate repository structure
    if (!repository.workspace || typeof repository.workspace !== 'object') {
        return { isValid: false, error: 'Invalid repository workspace information' };
    }
    const workspace = repository.workspace;
    if (!workspace.slug || typeof workspace.slug !== 'string') {
        return { isValid: false, error: 'Invalid workspace slug' };
    }
    // Validate pull request structure
    if (!pullrequest.id || typeof pullrequest.id !== 'number' || pullrequest.id <= 0) {
        return { isValid: false, error: `Invalid PR ID: ${pullrequest.id}` };
    }
    return { isValid: true };
}
/**
 * Parse and validate repository information from webhook payload
 */
export function parseRepoInfo(payload) {
    // Validate payload structure first
    const validation = validateWebhookPayload(payload);
    if (!validation.isValid) {
        throw new Error(validation.error);
    }
    // Extract and sanitize workspace
    const workspace = sanitizeString(payload.repository.workspace?.slug ||
        payload.repository.full_name?.split("/")[0]);
    // Extract and sanitize repo slug
    const repoSlug = sanitizeString(payload.repository.slug ||
        payload.repository.name);
    // Validate PR ID
    const prId = Number(payload.pullrequest.id);
    if (!Number.isInteger(prId) || prId <= 0) {
        throw new Error(`Invalid PR ID: ${payload.pullrequest.id}`);
    }
    if (!workspace || !repoSlug) {
        throw new Error("Could not determine workspace, repo slug, or PR id from webhook payload");
    }
    return { workspace, repoSlug, prId };
}
/**
 * Validate environment variables
 */
export function validateEnvironment() {
    const required = ['AZURE_OPENAI_API_KEY', 'AZURE_OPENAI_ENDPOINT'];
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Required environment variables missing: ${missing.join(', ')}`);
    }
}
/**
 * Sanitize file path to prevent directory traversal
 */
export function sanitizeFilePath(filePath) {
    if (!filePath || typeof filePath !== 'string') {
        return '';
    }
    // Remove directory traversal attempts
    return filePath
        .replace(/\.\./g, '')
        .replace(/[\/\\]/g, '/')
        .replace(/^\//, '')
        .trim();
}
/**
 * Validate confidence score
 */
export function validateConfidence(confidence) {
    const num = Number(confidence);
    if (isNaN(num) || num < 0 || num > 1) {
        return 0.8; // Default confidence
    }
    return num;
}

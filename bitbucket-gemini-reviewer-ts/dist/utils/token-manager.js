import crypto from 'node:crypto';
/**
 * Secure token manager with encryption
 */
export class TokenManager {
    static instance;
    cachedToken = null;
    tokenExpiry = 0;
    encryptionKey;
    constructor() {
        this.encryptionKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
    }
    static getInstance() {
        if (!TokenManager.instance) {
            TokenManager.instance = new TokenManager();
        }
        return TokenManager.instance;
    }
    async getValidToken() {
        if (this.cachedToken && Date.now() < this.tokenExpiry) {
            return this.decryptToken(this.cachedToken);
        }
        const newToken = await this.refreshToken();
        this.cachedToken = this.encryptToken(newToken);
        this.tokenExpiry = Date.now() + (55 * 60 * 1000); // 55 minutes
        return newToken;
    }
    encryptToken(token) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(this.encryptionKey, 'hex'), iv);
        let encrypted = cipher.update(token, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted;
    }
    decryptToken(encryptedToken) {
        const parts = encryptedToken.split(':');
        if (parts.length !== 2) {
            throw new Error('Invalid encrypted token format');
        }
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(this.encryptionKey, 'hex'), iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    async refreshToken() {
        const clientId = process.env.BITBUCKET_CLIENT_ID;
        const clientSecret = process.env.BITBUCKET_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
            throw new Error("BITBUCKET_CLIENT_ID and BITBUCKET_CLIENT_SECRET are required");
        }
        const response = await fetch("https://bitbucket.org/site/oauth2/access_token", {
            method: 'POST',
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
            },
            body: new URLSearchParams({
                grant_type: "urn:bitbucket:oauth2:jwt"
            })
        });
        if (!response.ok) {
            throw new Error(`Failed to refresh token: ${response.statusText}`);
        }
        const data = await response.json();
        return data.access_token;
    }
    clearCache() {
        this.cachedToken = null;
        this.tokenExpiry = 0;
    }
}

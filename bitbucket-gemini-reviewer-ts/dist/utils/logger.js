import winston from 'winston';
import crypto from 'node:crypto';
// Generate unique error IDs for tracking
export function generateErrorId() {
    return crypto.randomBytes(8).toString('hex');
}
// Structured logger configuration
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
    defaultMeta: { service: 'ai-reviewer' },
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(winston.format.colorize(), winston.format.simple())
        })
    ]
});
export default logger;

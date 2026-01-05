"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRPGService = void 0;
const koishi_1 = require("koishi");
/**
 * The Core TRPG Service
 */
class TRPGService extends koishi_1.Service {
    constructor(ctx) {
        super(ctx, 'trpg');
    }
    /**
     * Register a new RulePack
     */
    registerRule(rule) {
        // Implementation pending
    }
    /**
     * Get a registered RulePack by ID
     */
    getRule(id) {
        // Implementation pending
        return undefined;
    }
    /**
     * Get the current active character for a user
     */
    getCharacter(userId, guildId) {
        throw new Error('Not implemented');
    }
    /**
     * Create or update a character
     */
    saveCharacter(userId, char) {
        throw new Error('Not implemented');
    }
    /**
     * Roll dice using standard notation or rule-specific logic
     */
    roll(expression, ruleId) {
        // Implementation pending
        throw new Error('Not implemented');
    }
}
exports.TRPGService = TRPGService;

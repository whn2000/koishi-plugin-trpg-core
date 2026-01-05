import { Context, Service } from 'koishi';
declare module 'koishi' {
    interface Context {
        trpg: TRPGService;
    }
}
/**
 * Result of a check (success, failure, critical, etc.)
 */
export interface CheckResult {
    /** The rough level of success/failure (e.g., 'success', 'hard_success', 'fumble') */
    outcome: string;
    /** The rolled values */
    rolls: number[];
    /** The final calculated value */
    finalValue: number;
    /** The target value against which the check was made */
    target: number;
    /** Optional detailed description or flavor text */
    description?: string;
}
/**
 * Interface for decoupling specific rule logic (CoC, DND, etc.)
 */
export interface RulePack {
    /** Unique identifier for the rule pack */
    id: string;
    /** Display name */
    name: string;
    /**
     * Hook to modify or interpret a dice roll expression before execution.
     * Useful for rule-specific dice notation (e.g., CoC 7th penalty dice).
     * @param expression The raw dice expression (e.g., '1d100', 'p1')
     * @returns The standard 'ndm+x' expression to evaluate, or null if custom handling is performed.
     */
    resolveDice?(expression: string): string | null;
    /**
     * Determines the outcome of a check.
     * @param checkVal The value rolled/achieved.
     * @param targetVal The target attribute value.
     * @param ruleType Optional specific rule variant (e.g., 'combat', 'sanity')
     */
    applyCheck(checkVal: number, targetVal: number, ruleType?: string): CheckResult;
    /**
     * Renders the result of a check into a human-readable string.
     * @param result The result object from applyCheck
     * @param template Optional template string from config
     */
    renderResult(result: CheckResult, template?: string): string;
}
/**
 * Character Sheet Data Model
 */
export interface Character {
    id: number;
    userId: string;
    guildId?: string;
    name: string;
    /** Dynamic bag of attributes (e.g., { STR: 60, HP: 10 }) */
    attributes: Record<string, any>;
    /** Is this the currently active character for this user/context? */
    isCurrent: boolean;
}
/**
 * The Core TRPG Service
 */
export declare class TRPGService extends Service {
    constructor(ctx: Context);
    /**
     * Register a new RulePack
     */
    registerRule(rule: RulePack): void;
    /**
     * Get a registered RulePack by ID
     */
    getRule(id: string): RulePack | undefined;
    /**
     * Get the current active character for a user
     */
    getCharacter(userId: string, guildId?: string): Promise<Character | undefined>;
    /**
     * Create or update a character
     */
    saveCharacter(userId: string, char: Partial<Character>): Promise<Character>;
    /**
     * Roll dice using standard notation or rule-specific logic
     */
    roll(expression: string, ruleId?: string): Promise<CheckResult>;
}

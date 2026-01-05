import { Context, Schema } from 'koishi';
import { TRPGService, CheckResult } from './types';
export declare const name = "trpg-core";
export interface Config {
    attributes: string[];
    commands: {
        roll: string[];
        check: string[];
        char: string[];
    };
}
export declare const Config: Schema<Config>;
export declare class TRPG extends TRPGService {
    config: Config;
    constructor(ctx: Context, config: Config);
    private registerCommands;
    /**
     * Get the current active character for a user
     */
    getCharacter(userId: string, guildId?: string): Promise<import("./types").Character | undefined>;
    /**
     * Save/Update
     */
    saveCharacter(userId: string, data: Partial<import('./types').Character>): Promise<any>;
    /**
     * Core Roll Implementation
     */
    roll(expression: string, ruleId?: string): Promise<CheckResult>;
}

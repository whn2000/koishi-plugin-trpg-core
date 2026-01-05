import { Context } from 'koishi';
import { Character } from './types';
declare module 'koishi' {
    interface Tables {
        trpg_characters: Character;
    }
}
export declare function applyDatabase(ctx: Context): void;

import { RulePack } from '../types';
export interface DiceRollResult {
    rolls: number[];
    modifier: number;
    total: number;
    expression: string;
}
/**
 * Parses and rolls a dice expression.
 * Supports standard notation: NdM+X / NdM-X
 * Example: '1d100', '3d6+4', 'd20'
 *
 * @param expression The dice expression string.
 * @param rule Optional RulePack to intercept/modify the expression.
 */
export declare function rollDice(expression: string, rule?: RulePack): DiceRollResult;

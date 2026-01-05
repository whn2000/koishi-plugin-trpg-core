"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rollDice = rollDice;
/**
 * Parses and rolls a dice expression.
 * Supports standard notation: NdM+X / NdM-X
 * Example: '1d100', '3d6+4', 'd20'
 *
 * @param expression The dice expression string.
 * @param rule Optional RulePack to intercept/modify the expression.
 */
function rollDice(expression, rule) {
    // 1. Allow RulePack to resolve/modify the expression (e.g., alias handling)
    if (rule?.resolveDice) {
        const resolved = rule.resolveDice(expression);
        if (resolved) {
            expression = resolved;
        }
    }
    // 2. Parse the expression
    // Regex matches:
    // Group 1: Number of dice (optional, default 1)
    // Group 2: Number of sides
    // Group 3: Modifier (optional, e.g., +4, -2)
    const regex = /^(\d*)d(\d+)([\+\-]\d+)?$/i;
    const match = expression.trim().match(regex);
    if (!match) {
        throw new Error(`Invalid dice expression: "${expression}"`);
    }
    const count = match[1] ? parseInt(match[1], 10) : 1;
    const sides = parseInt(match[2], 10);
    const modifier = match[3] ? parseInt(match[3], 10) : 0;
    if (count > 100) {
        throw new Error('Too many dice to roll (limit 100)');
    }
    if (sides < 1) {
        throw new Error('Dice must have at least 1 side');
    }
    // 3. Roll
    const rolls = [];
    let sum = 0;
    for (let i = 0; i < count; i++) {
        const val = Math.floor(Math.random() * sides) + 1;
        rolls.push(val);
        sum += val;
    }
    const total = sum + modifier;
    return {
        rolls,
        modifier,
        total,
        expression
    };
}

import { RulePack, CheckResult } from '../types'

export class DefaultRule implements RulePack {
    id = 'k-trpg-default';
    name = 'Standard 1d100';

    resolveDice(expression: string): string | null {
        // Default rule always uses 1d100 for standard checks if no expression provided
        // But here we are resolving input. 
        // If input is empty, return '1d100'.
        if (!expression) return '1d100';
        return null; // Let standard parser handle specific expressions
    }

    applyCheck(checkVal: number, targetVal: number, ruleType?: string): CheckResult {
        // Standard CoC-like Check: 1d100 vs Target
        // 1 = Critical Success (often)
        // 1-5 = Extreme Success (sometimes)
        // <= Target/5 = Extreme
        // <= Target/2 = Hard
        // <= Target = Success
        // > Target = Failure
        // > 95 = Fumble (simplified)

        let outcome = 'failure';
        if (checkVal <= targetVal) {
            outcome = 'success';
            if (checkVal <= Math.floor(targetVal / 2)) outcome = 'hard_success';
            if (checkVal <= Math.floor(targetVal / 5)) outcome = 'extreme_success';
            if (checkVal === 1) outcome = 'critical_success';
        } else {
            if (checkVal > 95) outcome = 'fumble'; // Simplified rule
            // e.g. if target < 50, >96 is fumble. if target >= 50, 100 is fumble.
        }

        return {
            outcome,
            rolls: [], // Filled by caller usually, or we can pass it in if we change signature?
            // The interface defined applyCheck(checkVal, targetVal). 
            // So checkVal is the result of the roll.
            finalValue: checkVal,
            target: targetVal,
        };
    }

    renderResult(result: CheckResult, template?: string): string {
        // Default rendering
        // Can use template placeholders if we implemented that system
        // {name} {attr} {roll} {target} {outcome}

        const outcomeMap: Record<string, string> = {
            'critical_success': '大成功',
            'extreme_success': '极难成功',
            'hard_success': '困难成功',
            'success': '成功',
            'failure': '失败',
            'fumble': '大失败'
        };

        const outcomeText = outcomeMap[result.outcome] || result.outcome;

        return `${result.description || ''} 检定 ${outcomeText} (${result.finalValue}/${result.target})`;
    }
}

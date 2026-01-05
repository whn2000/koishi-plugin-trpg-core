import { RulePack, CheckResult } from '../types';
export declare class DefaultRule implements RulePack {
    id: string;
    name: string;
    resolveDice(expression: string): string | null;
    applyCheck(checkVal: number, targetVal: number, ruleType?: string): CheckResult;
    renderResult(result: CheckResult, template?: string): string;
}

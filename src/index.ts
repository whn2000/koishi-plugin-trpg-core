import { Context, Schema } from 'koishi'
import { TRPGService, CheckResult } from './types'
import { applyDatabase } from './database'
import { rollDice } from './logic/dice'

export const name = 'trpg-core'

export interface Config {
    attributes: string[]
    commands: {
        roll: string[]
        check: string[]
        char: string[]
    }
}

export const Config: Schema<Config> = Schema.object({
    attributes: Schema.array(String)
        .default(['力量', '敏捷', '体质', '智力', '意志', '魅力', '教育', '幸运'])
        .description('默认人物卡属性模板'),
    commands: Schema.object({
        roll: Schema.array(String).default(['r', 'roll']).description('掷骰指令别名'),
        check: Schema.array(String).default(['ra', 'check']).description('检定指令别名'),
        char: Schema.array(String).default(['st', 'char']).description('人物卡/属性录入指令别名'),
    }).description('指令设置'),
})

export class TRPG extends TRPGService {
    constructor(ctx: Context, public config: Config) {
        super(ctx)

        // Extend Database
        applyDatabase(ctx)

        // Register Commands
        this.registerCommands(ctx, config)
    }

    private registerCommands(ctx: Context, config: Config) {
        // 1. Roll Command
        const rollCmd = ctx.command('trpg/roll <expression:text>', '掷骰')
            .action(async (_, expression) => {
                if (!expression) return '请输入掷骰表达式，例如：1d100'
                try {
                    // Use core service roll method (which uses logic/dice)
                    const result = await this.roll(expression)
                    return `掷骰结果：${result.finalValue} (${result.rolls.join('+')})`
                } catch (e) {
                    return `掷骰失败：${e instanceof Error ? e.message : e}`
                }
            })

        // Apply aliases
        config.commands.roll.forEach(alias => rollCmd.alias(alias))

        // 2. Skill Check Command
        const checkCmd = ctx.command('trpg/check <attr:string> [value:number]', '属性检定')
            .action(async ({ session }, attr, value) => {
                if (!session?.userId) return '无法获取用户ID'

                // 1. Get Character
                const char = await this.getCharacter(session.userId, session.guildId)
                if (!char) return '当前没有已选定的人物卡，请先使用 .st 录入'

                // 2. Resolve Attribute
                // Fuzzy search or exact match from char.attributes
                const attrKey = Object.keys(char.attributes).find(k => k.toLowerCase() === attr.toLowerCase()) || attr;
                const attrVal = char.attributes[attrKey];

                if (attrVal === undefined) {
                    return `未找到属性：${attr}`;
                }

                const target = typeof value === 'number' ? value : parseInt(attrVal);
                if (isNaN(target)) {
                    return `属性 ${attrKey} 的值不是数字：${attrVal}`;
                }

                // 3. Roll
                // TODO: Use RulePack.resolveDice if needed, for now hardcode 1d100 for default checking
                // Actually, we should ask the TRPGService to perform a check, which uses the active rule.
                // For this step, we'll instantiate DefaultRule locally or use a method.
                // Let's assume we use the default 1d100 logic directly from the service or local.

                try {
                    const rollRes = await this.roll('1d100');

                    // 4. Apply Rule
                    // We need access to the current RulePack. 
                    // For now, let's create a temporary DefaultRule instance here or import it.
                    // In a real generic system, `this.getRule(char.ruleId)` would be used.
                    const { DefaultRule } = require('./logic/rule'); // Lazy import or move to top
                    const rule = new DefaultRule(); // Using default for now

                    const checkRes = rule.applyCheck(rollRes.finalValue, target);
                    checkRes.description = `${char.name} 的 ${attrKey}`;

                    return rule.renderResult(checkRes);

                } catch (e) {
                    return `检定出错：${e instanceof Error ? e.message : e}`;
                }
            })
        config.commands.check.forEach(alias => checkCmd.alias(alias))

        // 3. Character Record Command
        const charCmd = ctx.command('trpg/char [args:text]', '人物卡管理')
            .action(async ({ session }, args) => {
                if (!session?.userId) return '无法获取用户ID'

                // 1. Show current character if no args
                if (!args) {
                    const char = await this.getCharacter(session.userId, session.guildId)
                    if (!char) return '当前没有已选定的人物卡'
                    const attrs = Object.entries(char.attributes)
                        .map(([k, v]) => `${k}:${v}`)
                        .join(' ')
                    return `当前人物卡：${char.name}\n属性：${attrs}`
                }

                // 2. Parse args
                // Case A: Switch character by name ".st Alice" (no =)
                if (!args.includes('=') && !args.includes('：')) {
                    // Try to switch
                    // TODO: Implement switch logic strict
                    // For now, treat single word as name trigger if found
                    // But requirement says ".st 录入", maybe ".st name=Alice"?
                    // Let's support ".st name" to create/switch if it doesn't look like attr
                }

                // Case B: Update attributes ".st str=50 dex=60"
                const entries = args.split(/\s+/).filter(Boolean)
                const updates: Record<string, any> = {}
                let charName: string | undefined

                for (const entry of entries) {
                    // Support separators: = or ：
                    const [key, val] = entry.split(/=|：/)
                    if (!key || !val) {
                        // assume it might be name if no separator and first arg?
                        // but unsafe. Let's stick to key=value for now or specific syntax.
                        continue
                    }
                    if (key === 'name' || key === 'card') {
                        charName = val
                    } else {
                        const num = parseInt(val)
                        updates[key] = isNaN(num) ? val : num
                    }
                }

                if (Object.keys(updates).length === 0 && !charName) {
                    return '指令格式错误，请使用：属性=数值 (例如 .st str=50)'
                }

                // Retrieve or Create
                let char = await this.getCharacter(session.userId, session.guildId)

                // If specifying name, we might be switching or renaming
                if (charName) {
                    // Check if exists
                    const existing = await ctx.database.get('trpg_characters', {
                        userId: session.userId,
                        name: charName
                    })
                    if (existing.length > 0) {
                        // Switch to it
                        // Unset others
                        await ctx.database.set('trpg_characters', { userId: session.userId }, { isCurrent: false })
                        await ctx.database.set('trpg_characters', { id: existing[0].id }, { isCurrent: true })
                        char = existing[0]
                    } else {
                        // Create new if strictly requested? Or just rename current?
                        // For simplicity: If no current char, create new with this name.
                        // If current char exists, and we just passed name=X, maybe rename?
                        // Let's assume standard logic: find or create.

                        // If we didn't find it, we'll create it below or update current name
                    }
                }

                if (!char) {
                    // Create new
                    char = await ctx.database.create('trpg_characters', {
                        userId: session.userId,
                        guildId: session.guildId,
                        name: charName || '默认人物卡',
                        attributes: updates,
                        isCurrent: true
                    })
                    // Ensure others are not current (if any existed but weren't found?? shouldn't happen if getCharacter works)
                    await ctx.database.set('trpg_characters', {
                        userId: session.userId,
                        id: { $ne: char.id }
                    }, { isCurrent: false })

                    return `已创建并使用人物卡：${char.name}`
                }

                // Update existing
                if (charName && char.name !== charName) {
                    // If we found partial match above we would have switched.
                    // If we are here, we might want to rename?
                    // Let's allow renaming via .st name=NewName
                    await ctx.database.set('trpg_characters', { id: char.id }, { name: charName })
                    char.name = charName
                }

                if (Object.keys(updates).length > 0) {
                    const newAttrs = { ...char.attributes, ...updates }
                    await ctx.database.set('trpg_characters', { id: char.id }, { attributes: newAttrs })
                    return `已更新人物卡 ${char.name} 的属性：${Object.keys(updates).join(', ')}`
                }

                return `已切换至人物卡：${char.name}`
            })
        config.commands.char.forEach(alias => charCmd.alias(alias))
    }

    /**
     * Get the current active character for a user
     */
    async getCharacter(userId: string, guildId?: string) {
        const chars = await this.ctx.database.get('trpg_characters', {
            userId,
            isCurrent: true
        })
        if (chars.length > 0) return chars[0]
        // Fallback: get any char (optional, maybe not desired)
        // const anyChar = await this.ctx.database.get('trpg_characters', { userId })
        // if (anyChar.length > 0) return anyChar[0]
        return undefined
    }

    /**
     * Save/Update
     */
    async saveCharacter(userId: string, data: Partial<import('./types').Character>) {
        // Helper if needed elsewhere
        return {} as any
    }

    /**
     * Core Roll Implementation
     */
    async roll(expression: string, ruleId?: string): Promise<CheckResult> {
        // TODO: Integrate RulePack specific logic
        const res = rollDice(expression)
        return {
            outcome: 'roll',
            finalValue: res.total,
            rolls: res.rolls,
            target: 0,
            description: res.expression
        }
    }
}

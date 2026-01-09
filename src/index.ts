import { Context, Schema } from 'koishi'
import { TRPGService, CheckResult } from './types'
import { applyDatabase } from './database'
import { rollDice } from './logic/dice'

export const name = 'trpg-core'

export interface Config {
    attributes: string[]
    totalPoints: number
    commands: {
        roll: string[]
        check: string[]
        char: string[]
    }
}

export function apply(ctx: Context, config: Config) {
    ctx.plugin(TRPG, config)
}

export const Config: Schema<Config> = Schema.object({
    attributes: Schema.array(String)
        .default(['力量', '敏捷', '体质', '智力', '意志', '魅力', '教育', '幸运'])
        .description('默认人物卡属性模板'),
    totalPoints: Schema.number().default(360).description('创建角色时的固定总点数'),
    commands: Schema.object({
        roll: Schema.array(String).default(['r', 'roll']).description('掷骰指令别名'),
        check: Schema.array(String).default(['ra', 'check']).description('检定指令别名'),
        char: Schema.array(String).default(['st', 'char']).description('人物卡/属性录入指令别名'),
    }).description('指令设置'),
})

export class TRPG extends TRPGService {

    static inject = ['database']
    constructor(ctx: Context, public config: Config) {
        super(ctx)
        applyDatabase(ctx)
        this.registerCommands(ctx, config)
    }

    private registerCommands(ctx: Context, config: Config) {
        // 1. 注册指令
        ctx.command('trpg/register', '注册TRPG账户')
            .action(async ({ session }) => {
                const userId = session.userId
                const user = await ctx.database.get('trpg_users', { id: userId })
                if (user.length > 0) return '你已经注册过了。'

                await ctx.database.create('trpg_users', {
                    id: userId,
                    registeredAt: new Date()
                })
                return '注册成功！现在你可以使用 .st name=角色名 [属性=数值] 来创建你的第一个角色了。'
            })

        // 2. 修改角色管理指令 (charCmd)
        const charCmd = ctx.command('trpg/char [name:string]', '人物卡切换与管理')
            .action(async ({ session }, name) => {
                const userId = session.userId
                // 检查是否注册
                const user = await ctx.database.get('trpg_users', { id: userId })
                if (user.length === 0) return '请先使用 .register 注册账户。'

                // 如果没有输入名字，列出所有角色卡
                if (!name) {
                    const allChars = await ctx.database.get('trpg_characters', { userId })
                    if (allChars.length === 0) return '你还没有任何人物卡，请先创建。'

                    const list = allChars.map(c => `${c.isCurrent ? '★' : '  '} ${c.name}`).join('\n')
                    return `你的所有人物卡（最多5张）：\n${list}\n使用 ".st 角色名" 即可快速切换。`
                }

                // 尝试切换角色
                const target = await ctx.database.get('trpg_characters', { userId, name })
                if (target.length > 0) {
                    await ctx.database.set('trpg_characters', { userId }, { isCurrent: false })
                    await ctx.database.set('trpg_characters', { id: target[0].id }, { isCurrent: true })
                    return `已成功切换至人物卡：${target[0].name}`
                }

                return `未找到名为 "${name}" 的人物卡。创建新卡请使用: .st name=${name} 力量=xx ...`
            })
        // 1. Roll Command (保持不变)
        const rollCmd = ctx.command('trpg/roll <expression:text>', '掷骰')
            .action(async (_, expression) => {
                if (!expression) return '请输入掷骰表达式，例如：1d100'
                try {
                    const result = await this.roll(expression)
                    return `掷骰结果：${result.finalValue} (${result.rolls.join('+')})`
                } catch (e) {
                    return `掷骰失败：${e instanceof Error ? e.message : e}`
                }
            })
        config.commands.roll.forEach(alias => rollCmd.alias(alias))

        // 2. Skill Check Command (保持不变)
        const checkCmd = ctx.command('trpg/check <attr:string> [value:number]', '属性检定')
            .action(async ({ session }, attr, value) => {
                if (!session?.userId) return '无法获取用户ID'
                const char = await this.getCharacter(session.userId, session.guildId)
                if (!char) return '当前没有已选定的人物卡，请先使用 .st 录入'

                const attrKey = Object.keys(char.attributes).find(k => k.toLowerCase() === attr.toLowerCase()) || attr;
                const attrVal = char.attributes[attrKey];

                if (attrVal === undefined) return `未找到属性：${attr}`;

                const target = typeof value === 'number' ? value : parseInt(attrVal);
                if (isNaN(target)) return `属性 ${attrKey} 的值不是数字：${attrVal}`;

                try {
                    const rollRes = await this.roll('1d100');
                    const { DefaultRule } = require('./logic/rule');
                    const rule = new DefaultRule();
                    const checkRes = rule.applyCheck(rollRes.finalValue, target);
                    checkRes.description = `${char.name} 的 ${attrKey}`;
                    return rule.renderResult(checkRes);
                } catch (e) {
                    return `检定出错：${e instanceof Error ? e.message : e}`;
                }
            })
        config.commands.check.forEach(alias => checkCmd.alias(alias))

        // 3. Character Record Command (逻辑修改点)
        const charCmd = ctx.command('trpg/char [args:text]', '人物卡管理')
            .action(async ({ session }, args) => {
                if (!session?.userId) return '无法获取用户ID'

                if (!args) {
                    const char = await this.getCharacter(session.userId, session.guildId)
                    if (!char) return '当前没有已选定的人物卡'
                    const attrs = Object.entries(char.attributes)
                        .map(([k, v]) => `${k}:${v}`)
                        .join(' ')
                    return `当前人物卡：${char.name}\n属性：${attrs}`
                }

                const entries = args.split(/\s+/).filter(Boolean)
                const updates: Record<string, any> = {}
                let charName: string | undefined

                for (const entry of entries) {
                    const [key, val] = entry.split(/=|：/)
                    if (!key || !val) continue
                    if (key === 'name' || key === 'card') {
                        charName = val
                    } else {
                        const num = parseInt(val)
                        updates[key] = isNaN(num) ? val : num
                    }
                }

                if (Object.keys(updates).length === 0 && !charName) {
                    return '指令格式错误，请使用：属性=数值 (例如 .st 力量=50)'
                }

                let char = await this.getCharacter(session.userId, session.guildId)

                // --- 修改点：创建角色的加点校验逻辑 ---
                if (!char) {
                    // 1. 计算输入属性的总和
                    const currentTotal = config.attributes.reduce((sum, attr) => {
                        const val = updates[attr]
                        return sum + (typeof val === 'number' ? val : 0)
                    }, 0)

                    // 2. 校验总点数
                    if (currentTotal !== config.totalPoints) {
                        return `创建失败：当前分配总点数为 ${currentTotal}，必须等于固定总点数 ${config.totalPoints}。`
                    }

                    // 3. 校验属性是否填全（防止漏填某个属性）
                    const missingAttrs = config.attributes.filter(a => updates[a] === undefined)
                    if (missingAttrs.length > 0) {
                        return `创建失败：初次创建必须填入所有属性，当前缺失：${missingAttrs.join(', ')}`
                    }

                    // 校验通过，执行创建
                    char = await ctx.database.create('trpg_characters', {
                        userId: session.userId,
                        guildId: session.guildId,
                        name: charName || '默认人物卡',
                        attributes: updates,
                        isCurrent: true
                    })

                    await ctx.database.set('trpg_characters', {
                        userId: session.userId,
                        id: { $ne: char.id }
                    }, { isCurrent: false })

                    return `已成功创建并分配点数，人物卡：${char.name}`
                }
                // --- 校验结束 ---

                // 切换或更新现有角色逻辑
                if (charName && char.name !== charName) {
                    const existing = await ctx.database.get('trpg_characters', {
                        userId: session.userId,
                        name: charName
                    })
                    if (existing.length > 0) {
                        await ctx.database.set('trpg_characters', { userId: session.userId }, { isCurrent: false })
                        await ctx.database.set('trpg_characters', { id: existing[0].id }, { isCurrent: true })
                        char = existing[0]
                        return `已切换至人物卡：${char.name}`
                    } else {
                        // 重命名
                        await ctx.database.set('trpg_characters', { id: char.id }, { name: charName })
                        char.name = charName
                    }
                }

                if (Object.keys(updates).length > 0) {
                    return `你已有人物卡 ${char.name}。为了公平，创建后的属性修改请联系 GM。`
                }

                return `当前人物卡：${char.name}`
            })
        config.commands.char.forEach(alias => charCmd.alias(alias))
    }

    async getCharacter(userId: string, guildId?: string) {
        const chars = await this.ctx.database.get('trpg_characters', {
            userId,
            isCurrent: true
        })
        return chars.length > 0 ? chars[0] : undefined
    }

    async roll(expression: string, ruleId?: string): Promise<CheckResult> {
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
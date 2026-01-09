import { Context } from 'koishi'
import { Character } from './types'

declare module 'koishi' {
    interface Tables {
        trpg_users: TRPGUser     // 新增用户表
        trpg_characters: Character
    }
}

export interface TRPGUser {
    id: string      // 对应 userId (QQ号)
    registeredAt: Date
}

export function applyDatabase(ctx: Context) {
    ctx.model.extend('trpg_users', {
        id: 'string',
        registeredAt: 'date',
    }, { primary: 'id' })

    ctx.model.extend('trpg_characters', {
        id: 'unsigned',
        userId: 'string',
        guildId: 'string',
        name: 'string',
        attributes: 'json',
        isCurrent: { type: 'boolean', initial: false },
    }, {
        primary: 'id',
        autoInc: true,
    })
}

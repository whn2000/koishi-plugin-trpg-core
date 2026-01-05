import { Context } from 'koishi'
import { Character } from './types'

declare module 'koishi' {
    interface Tables {
        trpg_characters: Character
    }
}

export function applyDatabase(ctx: Context) {
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

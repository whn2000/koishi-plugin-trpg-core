"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyDatabase = applyDatabase;
function applyDatabase(ctx) {
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
    });
}

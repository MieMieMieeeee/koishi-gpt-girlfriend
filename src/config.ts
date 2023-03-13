import { Schema } from 'koishi'
export interface Config {
    command: string
    tag?: boolean
}

export const Config = Schema.object({
    command: Schema.string().description('画图插件的指令').default('rryth'),
    tag: Schema.boolean().description('是否回复生成的tag').default(true),
}).description('设置')
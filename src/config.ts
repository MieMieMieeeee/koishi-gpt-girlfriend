import { Schema } from 'koishi'
export interface Config {
    command: string
    tag?: boolean
    logLevel: number
}

export const Config = Schema.object({
    command: Schema.string().description('画图插件的指令').default('rryth'),
    commandOptionGptgf: Schema.string().description('画图指令的选项（仅女友盲盒有效）').default(''),
    tag: Schema.boolean().description('是否回复生成的tag').default(true),
    logLevel: Schema.number().description('日志输出等级').default(2),
}).description('设置')
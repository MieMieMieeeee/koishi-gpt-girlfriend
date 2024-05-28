import { Context, Quester, Session, Random } from 'koishi'
import { logger } from '.';
import { Config } from './config'

export const gptgfCmnMsgs = 'commands.gptgf.common.messages'

const MAX_FAVORABILITY = 300;
export const MSG_DELAY = 1400
export const RESPONSE_TIMEOUT = 20000

export async function getCurrentGirlfriend(ctx: Context,session: Session, uid?: string, name?: string) {
    const userUid = uid || session.uid;
    const existingData = await ctx.database.get('girlfriends', { uid: userUid });    if (existingData.length === 0) {
        // 如果不存在记录，抛出一个错误信息
        session.send((name ? `${name}: ` : '') + session.text(gptgfCmnMsgs + '.noCurrentGirlfriend'))
        return null
    }
    const girlfriend = existingData[0].currentGirlfriend;
    if (Object.keys(girlfriend).length === 0) {
        session.send((name ? `${name}: ` : '') + session.text(gptgfCmnMsgs + '.noCurrentGirlfriendSaved'))
        return null
    }
    return girlfriend
}

export async function ask(ctx: Context,session: Session, prompt: string) {
    await ctx.gpt.reset(session.userId);
    return ctx.gpt.ask(prompt, session.userId)
      .then(({ text }) => {
        return text.replace(/\n/g, "");
      })
      .catch((err) => {
        handleError(session, err);
        throw new Error("Service Error");
      });
}

export function generateFavorability(): number {
    const keys = Array.from({ length: 21 }, (_, i) => i - 10); // 生成包含-10到10的整数的数组
    const values = [4, 4, 3, 3, 2, 2, 1, 1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10];
    const weights: Record<number, number> = {};
    for (let i = 0; i < keys.length; i++) {
      weights[keys[i]] = values[i];
    }
    return parseInt(Random.weightedPick(weights));
}

export async function getFavorability(ctx: Context,uid: string) {
    const girlfriend = await ctx.database.get('girlfriends', { uid });
    return girlfriend[0].currentGirlfriend.favorability;
}
export async function updateFavorability(ctx: Context,session, favorScore):Promise<number> {
    const existingData = await ctx.database.get('girlfriends', { uid: session.uid });
    const girlfriend = existingData[0].currentGirlfriend;
    girlfriend.favorability ??= 50;
    // 计算新的好感度，并确保不超过最大值
    girlfriend.favorability = Math.min(girlfriend.favorability + parseInt(favorScore), MAX_FAVORABILITY);
    await ctx.database.set('girlfriends', { uid: session.uid }, { currentGirlfriend: girlfriend });
    return girlfriend.favorability
}

export function generateAge(): number {
    // 分布 mean = 50 stddev = 20
    const mean = 50, lowerBound = 8, upperBound = 60, avg = 20;
    const probabilities = [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 6, 6, 6, 7, 7, 8, 9, 9, 10, 10, 11, 11, 12, 13, 13, 14, 14, 15, 16, 16, 17, 17, 18, 18, 18, 19, 19, 19, 20, 20, 20, 20, 20, 20, 20, 20, 20, 19, 19, 19, 18, 18, 18, 17, 17, 16, 16, 15, 14, 14, 13, 13, 12, 11, 11, 10, 10, 9, 9, 8, 7, 7, 6, 6, 6, 5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1];
    let age = generateRandomNumber(probabilities);
    age =
      age < mean
        ? (age) * (avg - lowerBound) / mean + lowerBound
        : (age - mean) * (upperBound - avg) / mean + avg;

    age = Math.round(age);
    return age;
}

export function generateRandomNumber(probabilities: number[]): number {
    const cdf = probabilities.reduce((acc, val) => {
      acc.push(acc.length === 0 ? val : acc[acc.length - 1] + val);
      return acc;
    }, []);
    const rnd = Math.random() * cdf[cdf.length - 1];
    return cdf.findIndex((val) => val > rnd);
}

export function handleError(session: Session, err: Error) {
    const prefix = 'commands.gptsd.messages'
    if (Quester.isAxiosError(err)) {
        if (err.response?.data) {
        logger.error(err.response.data)
        return session.text(err.response.data.message)
        }
        if (err.response?.status === 402) {
        return session.text(`${prefix}.unauthorized`)
        } else if (err.response?.status) {
        return session.text(`${prefix}.response-error`, [err.response.status])
        } else if (err.code === 'ETIMEDOUT') {
        return session.text(`${prefix}.request-timeout`)
        } else if (err.code === 'ECONNRESET') {
        return session.text(`${prefix}.request-failed`, [err.code])
        } else if (err.code) {
        return session.text(`${prefix}.request-failed`, [err.code])
        }
    }
    logger.error(err)
    return session.text(`${prefix}.unknown-error`)
}



export async function drawImage(ctx: Context,session: Session, data: any, useTag = false) {
    let text = data.appearance + " " + data.hobbies + " " + session.text(gptgfCmnMsgs + ".female") + data.career + " ";
    const hairColor = (data.expect_hair_dye_color && data.expect_hair_dye_color !== 'null' && data.expect_hair_dye_color !== 'undefined' && data.expect_hair_dye_color !== '暂无' && data.expect_hair_dye_color !== '无') ? data.expect_hair_dye_color : data.hair_color ?? '';
    text += ` ${hairColor}hair ${data.hair_style} ${data.eye_color}eye ${data.body_shape} ${data.cloth}`;
    let promptTag = session.text('commands.gptsd.messages.prompt.baseTag', { text });
    if (useTag && 'tag' in data) {
      promptTag = session.text('commands.gptsd.messages.prompt.exampleTag', { text: data.tag.replace(/\n/g, "") })
        + session.text('commands.gptsd.messages.prompt.clothTag', { text });;
    }
    // console.log(promptTag);
    let sdPrompt;
    try {
      sdPrompt = await ask(ctx, session, promptTag);
      sdPrompt = sdPrompt.replace(/#/g, ",");
      // console.log(sdPrompt);
      data.tag = sdPrompt;
      session.permissions.push(`command:${ctx.$commander.get(ctx.config.command).name}`)
      logger.debug(`add temp permission: command:${ctx.$commander.get(ctx.config.command).name}`)  
      await session.execute(`${ctx.config.command} ${sdPrompt}`);
    } catch (err) {
      session.send(session.text(`commands.gptsd.messages.response-error`, [err.response.status]))
    }

    return data;
}
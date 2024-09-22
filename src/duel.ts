import { Context, Session, Random } from 'koishi'
import { Girlfriend, logger } from '.'
import { MSG_DELAY, RESPONSE_TIMEOUT, ask, drawImage, getCurrentGirlfriend, gptgfCmnMsgs, updateFavorability } from './utilities'
import { addCurrency } from './currency'

export async function startDuel(ctx: Context, session: Session, opponentSession: Session, playerGirlfriend: Girlfriend, opponentGirlfriend: Girlfriend) {
    try {
        await setGlobalBattleStatus(ctx, true)
        // 生成技能
        const playerSkills = await generateSkills(ctx,session, playerGirlfriend)
        const opponentSkills = await generateSkills(ctx,opponentSession, opponentGirlfriend)

        await initializeBattle(ctx,playerGirlfriend, playerSkills, session.uid)
        await initializeBattle(ctx,opponentGirlfriend, opponentSkills, opponentSession.uid)

        let lastSkills = { playerSkill: '', opponentSkill: '' }

        for (let round = 1; round <= 3; round++) {
            lastSkills = await executeRound(ctx, session, opponentSession, playerSkills, opponentSkills)
            const playerHp = await getBattleHp(ctx, session.uid)
            const opponentHp = await getBattleHp(ctx, opponentSession.uid)

            if (playerHp <= 0 || opponentHp <= 0) break
        }

        const playerHp = await getBattleHp(ctx, session.uid)
        const opponentHp = await getBattleHp(ctx, opponentSession.uid)
        await handleResult(session, opponentSession, playerHp, opponentHp, lastSkills)

        await setGlobalBattleStatus(ctx, false)
    } catch (err) {
        logger.error(err)
        await setGlobalBattleStatus(ctx, false)
    }

    async function handleResult(session: Session, opponentSession: Session, playerHp: number, opponentHp: number, lastSkill: { playerSkill: string, opponentSkill: string }) {

        let playerFavorabilityChange, opponentFavorabilityChange
        let resultMessage
    
        if (playerHp > opponentHp) {
            playerFavorabilityChange = 20
            opponentFavorabilityChange = -20
        } else if (playerHp < opponentHp) {
            playerFavorabilityChange = -20
            opponentFavorabilityChange = 20
        } else {
            playerFavorabilityChange = 20
            opponentFavorabilityChange = 20
            resultMessage = `平局！女友好感度各加20。`
            await session.sendQueued(resultMessage, MSG_DELAY)
        }
    
        const [playerFavorability, opponentFavorability, playerGirlfriend, opponentGirlfriend] = await Promise.all([
            updateFavorability(ctx, session, playerFavorabilityChange),
            updateFavorability(ctx, opponentSession, opponentFavorabilityChange),
            getCurrentGirlfriend(ctx, session),
            getCurrentGirlfriend(ctx, opponentSession)
        ])
        let player={}, opponentPlayer={}
        player["favorability"] = playerFavorability
        opponentPlayer["favorability"] = opponentFavorability
        player["girlfriend"] = playerGirlfriend
        opponentPlayer["girlfriend"] = opponentGirlfriend
        player["session"] = session
        opponentPlayer["session"] = opponentSession
        player["lastSkill"] = lastSkill.playerSkill
        opponentPlayer["lastSkill"] = lastSkill.opponentSkill

        let winner, loser
        if (playerHp > opponentHp) {
            winner = player
            loser = opponentPlayer
        } else if (playerHp < opponentHp) {
            winner = opponentPlayer
            loser = player
        }

        if (winner != undefined && loser != undefined) {
            await updateBattleStats(ctx, winner.session.uid, true)
            await updateBattleStats(ctx, loser.session.uid, false)
            const winnerCurrency = await addCurrency(ctx, winner.session.uid, 10)
            const loserCurrency = await addCurrency(ctx, loser.session.uid, 5)
            resultMessage = `${winner.session.username}赢了！当前好感度：${winner.favorability}(+20)，金币：${winnerCurrency}(+10)。\n${loser.session.username}输了！当前好感度：${loser.favorability}(-20)，金币：${loserCurrency}(+5)。`;    
            if (winner.girlfriend) await drawImageDuelResult(ctx, winner.session, winner.girlfriend, winner.lastSkill)
        } else {
            // 平局
            await updateBattleStats(ctx, session.uid, true)
            await updateBattleStats(ctx, opponentSession.uid, true)
        }

        await session.sendQueued(resultMessage, MSG_DELAY)
    }

}

async function drawImageDuelResult(ctx: Context,session: Session, data: any, skill:string) {
    let text = data.appearance + " " + data.hobbies + " " + session.text(gptgfCmnMsgs + ".female") + data.career + " "
    const hairColor = (data.expect_hair_dye_color && data.expect_hair_dye_color !== 'null' && data.expect_hair_dye_color !== 'undefined' && data.expect_hair_dye_color !== '暂无' && data.expect_hair_dye_color !== '无') ? data.expect_hair_dye_color : data.hair_color ?? ''
    text += ` ${hairColor}hair ${data.hair_style} ${data.eye_color}eye ${data.body_shape} ${data.cloth}`
    text += ` ${skill}(战斗技能)`
    let promptTag = ''
    if ('tag' in data) {
        promptTag = session.text('commands.gptgf.duel.messages.prompt.focus', { text: data.tag.replace(/\n/g, "") })
    }
    promptTag+= session.text('commands.gptgf.duel.messages.prompt.duelResultTag', { text })
    logger.debug(promptTag)
    let sdPrompt
    try {
      sdPrompt = await ask(ctx, session, promptTag)
      sdPrompt = sdPrompt.replace(/#/g, ",")
      sdPrompt += ", pixel art, gaming"
      logger.debug(sdPrompt)
      if (!session.permissions) {
        session.permissions = [];
      }
      session.permissions.push(`command:${ctx.$commander.get(ctx.config.command).name}`)
      await session.execute(`${ctx.config.command} ${ctx.config.commandOptionGptgf} ${sdPrompt}`)
    } catch (err) {
      session.send(session.text(`commands.gptsd.messages.response-error`, [err.response]))
    }

    return data
}

async function generateSkills(ctx:Context, session: Session, girlfriend: Girlfriend) {
    const prompt = `###目的:根据女友信息生成三个战斗技能 ###女友信息:${JSON.stringify(girlfriend)}###输出:以JSON返回技能的中文名字，不需要其他信息###输出模版：{"1": "","2": "","3": ""}`
    const response = await ask(ctx, session, prompt)
    const skills = JSON.parse(response)
    logger.debug("generateSkills:" + response)
    return skills
}

async function initializeBattle(ctx:Context, girlfriend: Girlfriend, skills: any[], uid: string) {
    await ctx.database.set('girlfriends', { uid }, {
        battle: {
            hp: 100,
            skills: skills,
        }
    })
}

async function getValidChoice(userSession: Session, skillsList: string[]) {
    const startTime = Date.now()
    let choice


    while (Date.now() - startTime < RESPONSE_TIMEOUT) {
        const timeRemaining = RESPONSE_TIMEOUT - (Date.now() - startTime)
        logger.debug("timeRemaining:", timeRemaining)
        choice = await userSession.prompt(timeRemaining)
        const parsedChoice = parseInt(choice)
        if (parsedChoice >= 1 && parsedChoice <= 3) {
            logger.debug(userSession.username, "有效:", parsedChoice)
            return parsedChoice - 1
        }
        logger.debug("无效:", parsedChoice)
        // 无效选择不提示，继续等待
    }

    // 超时选择随机技能
    return Random.int(0, skillsList.length - 1)
}

async function executeRound(ctx:Context,session: Session, opponentSession: Session, playerSkills: object, opponentSkills: object) {
    const playerSkillsArray = Object.values(playerSkills)
    const opponentSkillsArray = Object.values(opponentSkills)
    logger.debug(playerSkillsArray)
    logger.debug(opponentSkillsArray)

    const skillDescriptionTemplate = (skillsList: string[]) => 
        `1. ${skillsList[0]} - 保证命中\n` +
        `2. ${skillsList[1]} - 命中率80%，伤害适中\n` +
        `3. ${skillsList[2]} - 命中率50%，高额伤害，搏至无憾`
      
    const playerSkillsDescription = skillDescriptionTemplate(playerSkillsArray)
    const opponentSkillsDescription = skillDescriptionTemplate(opponentSkillsArray)
    
    let message = `${session.username}选择你的技能:\n${playerSkillsDescription}`
    message += `\n${opponentSession.username}选择技能:\n${opponentSkillsDescription}`
    
    await session.sendQueued(message, MSG_DELAY)
    const [playerSkillIndex, opponentSkillIndex] = await Promise.all([
        getValidChoice(session, playerSkillsArray),
        getValidChoice(opponentSession, opponentSkillsArray)
    ])

    const playerSkill = playerSkillsArray[playerSkillIndex]
    const opponentSkill = opponentSkillsArray[opponentSkillIndex]
  
    // 根据技能配置计算伤害
    const calculateDamage = (skillIndex: number, baseDamage: number) => {
        const skillConfig = {
            0: { hitRate: 1.0, damageMultiplier: 1 },
            1: { hitRate: 0.8, damageMultiplier: 1.25 },
            2: { hitRate: 0.5, damageMultiplier: 2 }
        }
        const config = skillConfig[skillIndex]
        const damage = Random.bool(config.hitRate) ? Random.int(10, baseDamage) * config.damageMultiplier : 0
        return Math.round(damage); 
    }
    const playerDamage = calculateDamage(playerSkillIndex, 50); 
    const opponentDamage = calculateDamage(opponentSkillIndex, 50); 
    logger.debug("玩家技能选择:", playerSkillIndex + 1, "伤害:", playerDamage)
    logger.debug("对手技能选择:", opponentSkillIndex + 1, "伤害:", opponentDamage)

    await updateBattleHp(ctx,session.uid, -opponentDamage)
    await updateBattleHp(ctx,opponentSession.uid, -playerDamage)

    const playerRemainingHp = await getBattleHp(ctx, session.uid)
    const opponentRemainingHp = await getBattleHp(ctx, opponentSession.uid)

    const generateSkillMessage = (username: string, skill: string, damage: number) => {
        return `${username}的女友使用了技能 [${skill}]，${damage > 0 ? `向对方造成了 ${damage} 点伤害` : '未命中'}。\n`
    }
    
    message = generateSkillMessage(session.username, playerSkill, playerDamage)
    message += generateSkillMessage(opponentSession.username, opponentSkill, opponentDamage)
    message += `${session.username}的女友剩余血量：${playerRemainingHp}，${opponentSession.username}的女友剩余血量：${opponentRemainingHp}。`
    await session.sendQueued(message, MSG_DELAY)
    return {
        playerSkill,
        opponentSkill
    }
}

export async function checkGlobalBattleStatus(ctx: Context): Promise<boolean> {
    const battleStatus = await ctx.database.get('girlfriends_global', { id: 1 })
    return battleStatus[0].inBattle
}

export async function setGlobalBattleStatus(ctx: Context, status: boolean): Promise<void> {
    await ctx.database.set('girlfriends_global', { id: 1 }, { inBattle: status })
}

async function getBattleHp(ctx: Context,uid: string) {
    const girlfriend = await ctx.database.get('girlfriends', { uid: uid })
    return girlfriend[0].battle.hp
}

async function updateBattleHp(ctx: Context,uid: string, change: number) {
    const girlfriend = await ctx.database.get('girlfriends', { uid: uid })
    const newHp = girlfriend[0].battle.hp + change
    await ctx.database.set('girlfriends', { uid }, {
        battle: {
            ...girlfriend[0].battle,
            hp: newHp,
        }
    })
    return newHp
}

async function updateBattleStats(ctx: Context, uid: string, isWinner: boolean) {
    const battleStats = await getBattleStats(ctx, uid)
    if (!battleStats.totalBattles) {
        battleStats.totalBattles = 1
    } else {
        battleStats.totalBattles += 1
    }
    if (isWinner) {
        if (!battleStats.totalWins) {
            battleStats.totalWins = 1
        } else {
            battleStats.totalWins += 1
        }
    }
    await ctx.database.set('girlfriends', { uid }, { battleStats: battleStats })
}

export async function getBattleStats(ctx: Context, uid: string) {
    const girlfriend = await ctx.database.get('girlfriends', { uid:uid });  
    return girlfriend[0].battleStats
}
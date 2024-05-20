import { Context, Logger, Quester, Session, Command, h, Random } from 'koishi'
import { Config } from './config'
import { } from '@mirror_cy/gpt'
import { log } from 'console'


export const name = 'gptsd'

export * from './config'

export const inject = {
  required: ['gpt','database'],
}

export const usage = `
## 指令：
- gptsd gpt约稿 智能约稿
  - 用gpt生成tag并直接调用绘画插件绘图。
- gptgf 女友盲盒  
  - 使用gpt服务随机抽取一个女友资料，并调用绘图插件对女友进行绘图。
- [如果你想看栗子](https://www.npmjs.com/package/@miemiemie/koishi-plugin-gpt-girlfriend)
## 注意：
- gpt服务（需额外安装）推荐rr-gpt
- 画图插件（需额外安装）推荐rryth或者novelai`

const logger = new Logger(name)

const MAX_FAVORABILITY = 300;
const RESPONSE_TIMEOUT = 20000;
const MSG_DELAY = 1400;

declare module 'koishi' {
  interface Tables {
    girlfriends: Girlfriends;
    girlfriends_global: GirlfriendsGlobal;
  }
}

interface Girlfriend {
  age?: string;
  hair_color?: string;
  expect_hair_dye_color?: string;
  hair_style?: string;
  eye_color?: string;
  speciality?: string;
  career?: string;
  personality?: string;
  height?: string;
  weight?: string;
  cloth?: string;
  appearance?: string;
  face_shape?: string;
  body_shape?: string;
  hobbies?: string;
  background?: string;
  tag?: string;
  favorability?: number;
}

export interface Girlfriends {
  id: number;
  uid: string;
  currentGirlfriend?: Girlfriend;
  newGirlfriend?: JSON;
  battle?: {
    hp: number;
    skills?: any[];
  };
  other?: string;
}

interface GirlfriendsGlobal {
  id: number;
  inBattle: boolean;
}

async function initGlobal(ctx: Context) {
  const existingStatus = await ctx.database.get('girlfriends_global', { id: 1 });
  if (existingStatus.length === 0) {
    await ctx.database.create('girlfriends_global', { id: 1, inBattle: false });
  }
}

export function apply(ctx: Context, config: Config) {
  ctx.model.extend('girlfriends_global', {
    id: 'integer',
    inBattle: 'boolean',
  }, {
    autoInc: true,
  });
  
  initGlobal(ctx);

  ctx.i18n.define('zh', require('./locales/zh'))
  const gptgfCmnMsgs = 'commands.gptgf.common.messages'
  ctx.command(`gptsd <prompts:text>`)
    .alias('gpt约稿')
    .alias('智能约稿')
    .action(async ({ session }, text) => {
      await gptsd(session, text)
    });
  ctx.command(`gptgf <prompts:text>`)
    .alias('女友盲盒')
    .action(async ({ session, options }, text) => {
      session.send(session.text(".init"));
      await gptgf(session, text);
    });

  ctx.command(`gptgf.save <prompts:text>`)
    .alias('gptgf.保存女友')
    .action(async ({ session, options }, text) => {
      try {
        // 将结果保存到数据库中
        await saveResultToDatabase(session, text)
        session.send(session.text(".saved"))
      } catch (err) {
        // 如果执行内部指令发生错误，则发送错误消息
        session.send(session.text('.saved-error', [err.message]))
      }
    });

  ctx.command(`gptgf.show`)
    .alias('gptgf.女友信息')
    .action(async ({ session }) => {
      const girlfriend = await getCurrentGirlfriend(session);
      if (girlfriend) {
        await formatData(session, girlfriend);
      }
    });

  ctx.command('gptgf.draw')
    .alias('gptgf.康康女友')
    .action(async ({ session }) => {
      const girlfriend = await getCurrentGirlfriend(session);
      if (girlfriend) {
        await drawImage(session, girlfriend);
      }
    });

  ctx.command(`gptgf.clothes`)
    .alias('gptgf.女友暖暖')
    .action(async ({ session }) => {
      const girlfriend = await getCurrentGirlfriend(session);
      if (girlfriend) {
        try {
          // 随机选择一种服饰
          const clothes = ["连衣裙", "牛仔裤套装", "西装", "T恤和短裤", "背心和短裤", "运动套装", "针织衫和长裤", "迷你裙", "卫衣和运动裤", "运动背心和运动裤", "牛仔夹克和牛仔裤", "连体裤", "运动外套和运动裤", "连衣裤", "短袖衬衫和长裤", "背心和短裙", "吊带裙", "针织衫和短裙", "运动背心和短裤", "连衣短裤", "长袖衬衫和长裤", "迷你半身裙", "背心和连衣裤", "运动外套和短裤", "连体裙", "短袖衬衫和短裤", "中长半身裙", "背心和长裤", "运动上衣和短裤", "吊带连衣裙", "针织衫和长袖裙", "运动背心和长裤", "吊带长裤", "长袖衬衫和短裙", "阔腿裤套装", "连体长裤", "短袖T恤和短裙", "长款连帽卫衣和运动裤", "长袖连衣裙", "民族风连衣裙", "白衬衫和铅笔裙", "高领毛衣和阔腿裤", "休闲运动装", "宽松长裤", "蕾丝连衣裙", "背心和热裤", "学院风套装", "灯笼袖连衣裙", "运动套装", "条纹T恤和牛仔裤", "低胸吊带上衣和短裙", "紧身背心和瑜伽裤", "露脐上衣和迷你裙", "衬衫和长裤", "连衣长裤", "泳装", "雪纺连衣裙", "西装外套和裤子", "军装", "毛衣和短裙", "小吊带和短裙", "针织背心和阔腿裤", "舞蹈服", "包臀裙", "女仆装", "紧身连衣裤", "格子衬衫和牛仔裤", "蝙蝠袖连衣裙", "职业套装", "铅笔裤", "吊带连体裤", "防晒服", "丝绸连衣裙", "皮衣和紧身裤", "短款卫衣和短裤", "蕾丝上衣和长裙", "冬季套装", "吊带连衣裤", "背心和阔腿裤", "毛衣和长裤", "旗袍", "抹胸上衣和短裙", "牛仔短裤和T恤", "棒球服", "皮草大衣和长裤", "裙子套装", "旗袍裤", "棉麻连衣裙"];
          const clothType = clothes[Math.floor(Math.random() * clothes.length)];
          // 生成新的女友信息
          const newGirlfriend = { ...girlfriend, cloth: clothType };

          await drawImage(session, newGirlfriend, true);
        } catch (err) {
          session.send(err.message);
        }
      }
    });

  ctx.command(`gptgf.date`)
    .alias('gptgf.女友约会')
    .action(async ({ session }) => {
      const girlfriend = await getCurrentGirlfriend(session);
      if (girlfriend) {
        try {
          const format = `{plans:[{"plan":}]}`;
          let reqDateOptions = session.text(`.prompt.baseDateOptions`) + format;
          reqDateOptions += ` age:${girlfriend.age},speciality:${girlfriend.speciality},career:${girlfriend.career},personality:${girlfriend.personality},hobbies:${girlfriend.hobbies}`;
          // console.log(reqDateOptions);
          const optionsRes = await ask(session, reqDateOptions);
          // console.log(optionsRes);
          const optionsResJson = JSON.parse(optionsRes.match(/{.*}/)[0]);

          if (optionsResJson.plans.length > 4) {
            optionsResJson.plans = optionsResJson.plans.slice(0, 4);
          }
          const letters = ['1', '2', '3', '4'];

          // 保存每个选项和活动名称的数组
          const activityLines = optionsResJson.plans.map((plan, index) => {
            const prefix = /^\d/.test(plan.plan) ? '' : `${letters[index]}. `;
            return `${prefix}${plan.plan}`;
          });

          const outputString = activityLines.join('\n');
          session.send(
            h('quote', { id: session.messageId }) +
            session.text('.chooseOptions') + '\n'
            + outputString
          );
          const selectedPlan = optionsResJson.plans[parseInt(await getUserInput(session)) - 1].plan;
          // console.log(selectedPlan);
          const favorScore = generateFavorability();
          const sign = favorScore < 0 ? '-' : '+';
          const favorScoreString = sign + Math.abs(favorScore).toString();
          const dataStoryReq = session.text(`.prompt.baseDateStory`, { favorScore: favorScoreString, selectedPlan });
          // console.log(dataStoryReq);
          const dateStoryRes = await ask(session, dataStoryReq);
          // console.log(dateStoryRes);
          const favorability = await updateFavorability(session, favorScore);
          session.send(
            h('quote', { id: session.messageId }) +
            session.text(`.dateStory`, { dateStory: dateStoryRes, favorability: favorability.toString(), favorabilityScore: favorScoreString })
          );
          // 好感度
          if (favorability >= 100) {
            session.send(
              h('quote', { id: session.messageId }) +
              session.text('.favorability100')
            );
            try {
              const clothes = ["\u6BD4\u57FA\u5C3C"];
              const clothType = clothes[Math.floor(Math.random() * clothes.length)];
              // 生成新的女友信息
              const newGirlfriend = { ...girlfriend, cloth: clothType };
              await drawImage(session, newGirlfriend, true);
            } catch (err) {
              session.send(err.message);
            }
          }

        } catch (err) {
          session.send(err.message);
        }
      }
    });
  
  ctx.command('gptgf.duel <targetUser:text>')
  .alias('gptgf.女友决斗')
  .action(async ({ session }, targetUser) => {
    logger.debug('targetUser',targetUser)
    const match = targetUser.match(/id="(\d+)" name="(.+?)"/);
    if (!match) {
      session.send('请 @ 一个玩家来决斗。');
      return;
    }
    const opponentId = match[1];
    const opponentName = match[2];
    const opponentUid = `${session.platform}:${opponentId}`;
    logger.debug('opponentUid',opponentUid)
    logger.debug('opponentName',opponentName)
    logger.debug('session',session.user)
    logger.debug('session',session.event)
    logger.debug('session',session.channel)

    let isGlobalInBattle = await checkGlobalBattleStatus(ctx);
    if (isGlobalInBattle) {
      await session.sendQueued('当前已有一场决斗进行中，请稍后再试。',MSG_DELAY);
      return;
    }

    const playerGirlfriend = await getCurrentGirlfriend(session);

    if (!playerGirlfriend) {
      return;
    }

    const opponentGirlfriend = await getCurrentGirlfriend(session,opponentUid,opponentName);
    
    if (!opponentGirlfriend) {
      session.sendQueued('双方都需要拥有女友才能进行决斗。',MSG_DELAY);
      return;
    }
    // const opponentEvent= new Event
    // const opponentSession = new Session(session.bot,session.event);
    session.sendQueued(`${opponentName}, 你被挑战了！回复 "接受" 来接受决斗。（测试版中如遇bug请at咩咩）`,MSG_DELAY);


    let opponentAgreed = false;
    ctx.user(opponentId).once('message', async (msgSession) => {
      if (msgSession.content === '接受') {
        //check again
        isGlobalInBattle = await checkGlobalBattleStatus(ctx);
        if (await checkGlobalBattleStatus(ctx)) {
          await session.sendQueued('当前已有一场决斗进行中，请稍后再试。',MSG_DELAY);
          return;
        }
        opponentAgreed = true;
        await startDuel(session, msgSession, playerGirlfriend, opponentGirlfriend);
        return;
      } else {
        session.sendQueued('对方拒绝了决斗。',MSG_DELAY);
        return;
      }
    });

    // setTimeout(() => {
    //   if (!opponentAgreed) {
    //     session.send('对方没有在规定时间内回复。');
    //   }
    // }, RESPONSE_TIMEOUT);
  });

  
  async function startDuel(session: Session, opponentSession: Session, playerGirlfriend: Girlfriend, opponentGirlfriend: Girlfriend) {
    try{
      await setGlobalBattleStatus(ctx, true);
      // 生成技能
      const playerSkills = await generateSkills(session, playerGirlfriend);
      const opponentSkills = await generateSkills(opponentSession, opponentGirlfriend);
      
      await initializeBattle(playerGirlfriend, playerSkills, session.uid);
      await initializeBattle(opponentGirlfriend, opponentSkills, opponentSession.uid);

      for (let round = 1; round <= 3; round++) {
        await executeRound(session, opponentSession, playerSkills, opponentSkills);
        const playerHp = await getBattleHp(session.uid);
        const opponentHp = await getBattleHp(opponentSession.uid);

        if (playerHp <= 0 || opponentHp <= 0) break;
      }

      const playerHp = await getBattleHp(session.uid);
      const opponentHp = await getBattleHp(opponentSession.uid);

      let resultMessage;

      if (playerHp > opponentHp) {

        const playerFavorability = await updateFavorability(session, 20);
        const opponentFavorability = await updateFavorability(opponentSession, -20);
      
        resultMessage = `${session.username}赢了！女友好感度增加20，当前好感度为${playerFavorability}。\n${opponentSession.username}输了！女友好感度减少20，当前好感度为${opponentFavorability}。`;
      } else if (playerHp < opponentHp) {

        const playerFavorability = await updateFavorability(session, -20);
        const opponentFavorability = await updateFavorability(opponentSession, 20);
      
        resultMessage = `${session.username}输了！女友好感度减少20，当前好感度为${playerFavorability}。\n${opponentSession.username}赢了！女友好感度增加20，当前好感度为${opponentFavorability}。`;
      } else {
        resultMessage = '平局！女友好感度不变。';
      }
      
      await session.sendQueued(resultMessage,MSG_DELAY);
      await setGlobalBattleStatus(ctx, false);
    } catch(err){
      logger.error(err)
      await setGlobalBattleStatus(ctx, false);
    }
    
  }

  async function generateSkills(session: Session, girlfriend: Girlfriend) {
    const prompt = `###目的:根据女友信息生成三个战斗技能 ###女友信息:${JSON.stringify(girlfriend)}###输出:以JSON返回技能的中文名字，不需要其他信息###输出模版：{"1": "","2": "","3": ""}`;
    const response = await ask(session, prompt);
    const skills = JSON.parse(response);
    logger.debug("generateSkills:"+response)
    return skills;
  }

  async function initializeBattle(girlfriend: Girlfriend, skills: any[], uid: string) {
    await ctx.database.set('girlfriends', { uid }, {
      battle: {
        hp: 100,
        skills: skills,
      }
    });
  }

  async function getValidChoice(userSession: Session, skillsList: string[]) {
    const startTime = Date.now();
    let choice;

    while (Date.now() - startTime < RESPONSE_TIMEOUT) {
      const timeRemaining = RESPONSE_TIMEOUT - (Date.now() - startTime);
      logger.debug("timeRemaining:",timeRemaining)
      choice = await userSession.prompt(timeRemaining);
      const parsedChoice = parseInt(choice);
      if (parsedChoice >= 1 && parsedChoice <= 3) {
        logger.debug(userSession.username,"有效:",parsedChoice)
        return parsedChoice-1;
      }
      logger.debug("无效:",parsedChoice)
      // 无效选择不提示，继续等待
    }

    // 超时选择随机技能
    return Random.int(0, skillsList.length - 1);
  }

  async function executeRound(session: Session, opponentSession: Session, playerSkills: object, opponentSkills: object) {
    const playerSkillsArray = Object.values(playerSkills);
    const opponentSkillsArray = Object.values(opponentSkills);
    logger.debug(playerSkillsArray)
    logger.debug(opponentSkillsArray)
    const playerSkillsList = playerSkillsArray.map((skill, index) => `${index + 1}. ${skill}`).join('\n');
    const opponentSkillsList = opponentSkillsArray.map((skill, index) => `${index + 1}. ${skill}`).join('\n');
    logger.debug(playerSkillsList)
    logger.debug(opponentSkillsList)
    let message
    message=`${session.username}选择你的技能:\n${playerSkillsList}`
    message+=`\n${opponentSession.username}选择你的技能:\n${opponentSkillsList}`
    await session.sendQueued(message,MSG_DELAY)
    const [playerSkillIndex, opponentSkillIndex] = await Promise.all([
      getValidChoice(session, playerSkillsArray),
      getValidChoice(opponentSession, opponentSkillsArray)
    ]);

    const playerDamage = Random.int(0, 100);
    const opponentDamage = Random.int(0, 100);

    await updateBattleHp(session.uid, -opponentDamage);
    await updateBattleHp(opponentSession.uid, -playerDamage);

    message=`${session.username}的女友使用了技能 ${playerSkillsArray[playerSkillIndex]}，向对方造成了 ${playerDamage} 点伤害。\n`
    message+=`${opponentSession.username}的女友使用了技能 ${opponentSkillsArray[opponentSkillIndex]}，向对方造成了 ${opponentDamage} 点伤害。\n`
    message+=`${session.username}的女友剩余血量：${await getBattleHp(session.uid)}，${await opponentSession.username}的女友剩余血量：${await getBattleHp(opponentSession.uid)}。`
    await session.sendQueued(message,MSG_DELAY)
  }

  async function checkGlobalBattleStatus(ctx: Context): Promise<boolean> {
    const battleStatus = await ctx.database.get('girlfriends_global', { id: 1 });
    return battleStatus[0].inBattle;
  }
  
  async function setGlobalBattleStatus(ctx: Context, status: boolean): Promise<void> {
    await ctx.database.set('girlfriends_global', { id: 1 }, { inBattle: status });
  }

  async function getBattleHp(uid: string) {
    const girlfriend = await ctx.database.get('girlfriends', { uid });
    return girlfriend[0].battle.hp;
  }

  async function updateBattleHp(uid: string, change: number) {
    const girlfriend = await ctx.database.get('girlfriends', { uid });
    const newHp = girlfriend[0].battle.hp + change;
    await ctx.database.set('girlfriends', { uid }, {
      battle: {
        ...girlfriend[0].battle,
        hp: newHp,
      }
    });
    return newHp;
  }

  async function getFavorability(uid: string) {
    const girlfriend = await ctx.database.get('girlfriends', { uid });
    return girlfriend[0].currentGirlfriend.favorability;
  }
  async function updateFavorability(session, favorScore):Promise<number> {
    const existingData = await ctx.database.get('girlfriends', { uid: session.uid });
    const girlfriend = existingData[0].currentGirlfriend;
    girlfriend.favorability ??= 50;
    // 计算新的好感度，并确保不超过最大值
    girlfriend.favorability = Math.min(girlfriend.favorability + parseInt(favorScore), MAX_FAVORABILITY);
    await ctx.database.set('girlfriends', { uid: session.uid }, { currentGirlfriend: girlfriend });
    return girlfriend.favorability
  }
 
  function generateFavorability(): number {
    const keys = Array.from({ length: 21 }, (_, i) => i - 10); // 生成包含-10到10的整数的数组
    const values = [4, 4, 3, 3, 2, 2, 1, 1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10];
    const weights: Record<number, number> = {};
    for (let i = 0; i < keys.length; i++) {
      weights[keys[i]] = values[i];
    }
    return parseInt(Random.weightedPick(weights));
  }

  async function getUserInput(session: Session, maxRetries = 3): Promise<string> {
    for (let i = 0; i < 3; i++) {
      const userInput = await session.prompt(60000);
      if (!userInput) {
        throw new Error(session.text('.retryTimeout'));
      }
      if (userInput.match(/^[1-4]$/)) {
        return userInput;
      } else {
        session.send(session.text('.retry'));
      }
    }
    throw new Error(session.text('.retryStop'));
  }

  async function getCurrentGirlfriend(session: Session, uid?: string, name?: string) {
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

  ctx.model.extend('girlfriends', {
    id: 'unsigned',
    uid: 'string',
    currentGirlfriend: 'json',
    newGirlfriend: 'json',
    battle: 'json',
    other: 'string',
  }, {
    autoInc: true,
  });

  async function gptsd(session: Session, text: string,) {
    if (!text?.trim())
      return session.execute(`help ${name}`);
    const prompt = session.text('.prompt.baseTag', { text });
    const regex = /[^a-zA-Z0-9,\s]/g;
    const sdPrompt = (await ask(session, prompt)).replace(/#/g, ",").replace(regex, '');
    if (config.tag) {
      session.send(`tag： ${sdPrompt}`);
    }
    await session.execute(`${config.command} ${sdPrompt}`);
  }

  async function saveResultToDatabase(session: Session, text: string) {
    const existingData = await ctx.database.get('girlfriends', { uid: session.uid });

    if (existingData.length > 0) {
      // 如果已经存在记录，将新女友信息存储到当前女友信息中
      const currentGirlfriend = existingData[0].newGirlfriend;
      await ctx.database.set('girlfriends', { uid: session.uid }, { currentGirlfriend: currentGirlfriend });
    } else {
      // 如果不存在记录，抛出一个错误信息
      throw new Error('You don\'t have girlfriend yet');
    }
  }

  async function gptgf(session: Session, text: string,) {

    const types = ["Japanese anime", "Chinese", "abnormal anime"];
    // const types = ["Japanese anime", "abnormal anime"];
    // const types = ["loli"];
    const type = types[Math.floor(Math.random() * types.length)];
    const prompt = session.text('.prompt.baseAniGirl', { type: generateAge().toString() + "'s " + type });
    console.log(prompt);
    const response = (await ask(session, prompt)).replace(/（可选）/g, '');
    console.log(response);
    const data = JSON.parse(response.match(/{.*?}/s)[0]);

    const existingData = await ctx.database.get('girlfriends', { uid: session.uid });

    if (existingData.length > 0) {
      await ctx.database.set('girlfriends', { uid: session.uid }, { newGirlfriend: data });
    } else {
      await ctx.database.create('girlfriends', {
        uid: session.uid,
        currentGirlfriend: undefined, // 现任女友信息为空
        newGirlfriend: data,
        other: undefined,
      });
    }

    await formatData(session, data);

    const taggedData = await drawImage(session, data);

    if (taggedData.tag) {
      await ctx.database.set('girlfriends', { uid: session.uid }, { newGirlfriend: taggedData });
    }
  }

  async function formatData(session: Session, data: any) {
    const translations = {
      "age": "年龄",
      "hair_color": "发色",
      "eye_color": "瞳色",
      "height": "身高",
      "weight": "体重",
      "career": "职业",
      "specialty": "特长",
      "appearance": "外貌",
      "cloth": "服饰",
      "hobbies": "爱好",
      "background": "背景"
    };

    //筛选输出属性
    const translatedData = {};
    for (const key in data) {
      const translatedKey = translations[key] || key;
      translatedData[translatedKey] = data[key];
    }
    const selectedKeys = ['职业', '特长', '外貌', "服饰", '爱好', '背景'];
    let selectedData = Object.fromEntries(
      Object.entries(translatedData).filter(([key, value]) => selectedKeys.includes(key))
    );
    selectedData = {
      "体型": `${data.height}/${data.weight}`,
      ...selectedData,
    }

    const keyValueStrings = Object.entries(selectedData).map(([key, value]) => `${key}: ${value}`);

    const output = keyValueStrings.join("\n");
    let age = data.age.match(/\d+/)?.[0];
    age = age + session.text(gptgfCmnMsgs + (age ? ".age" : ".ageUnkown"))
    session.send(
      h('quote', { id: session.messageId }) +
      session.text('.newFriend', { age: age, output: output }).replace(/null/g, "不明")
    );
  }


  async function ask(session: Session, prompt: string) {
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

  async function drawImage(session: Session, data: any, useTag = false) {
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
      sdPrompt = await ask(session, promptTag);
      sdPrompt = sdPrompt.replace(/#/g, ",");
      // console.log(sdPrompt);
      data.tag = sdPrompt;
      await session.execute(`${config.command} ${sdPrompt}`);
    } catch (err) {
      session.send(session.text(`commands.gptsd.messages.response-error`, [err.response.status]))
    }

    return data;
  }

  function handleError(session: Session, err: Error) {
    const prefix = 'commands.gptsd.messages'
    // console.log(err)
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

  function generateAge(): number {
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

  function generateRandomNumber(probabilities: number[]): number {
    const cdf = probabilities.reduce((acc, val) => {
      acc.push(acc.length === 0 ? val : acc[acc.length - 1] + val);
      return acc;
    }, []);
    const rnd = Math.random() * cdf[cdf.length - 1];
    return cdf.findIndex((val) => val > rnd);
  }

  

}


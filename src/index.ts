import { Context, Logger, Quester, Session, Command, h, Random, Dict } from 'koishi'
import { Config } from './config'
import { } from '@mirror_cy/gpt'
import { gptgfCmnMsgs, getCurrentGirlfriend, handleError, generateFavorability, generateAge, ask, updateFavorability, drawImage } from './utilities'
import { checkGlobalBattleStatus, startDuel } from './duel'
import { MSG_DELAY } from './utilities'
import { log } from 'console'

export const name = 'gptsd'

export * from './config'
export * from './interfaces'

export const inject = {
  required: ['gpt', 'database'],
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


export const logger = new Logger(name)

async function initGlobal(ctx: Context) {
  const existingStatus = await ctx.database.get('girlfriends_global', { id: 1 });
  if (existingStatus.length === 0) {
    await ctx.database.create('girlfriends_global', { id: 1, inBattle: false });
  }
}

export function apply(ctx: Context, config: Config) {
  logger.level=config.logLevel
  ctx.model.extend('girlfriends_global', {
    id: 'integer',
    inBattle: 'boolean',
  }, {
    autoInc: true,
  });

  initGlobal(ctx);

  ctx.i18n.define('zh', require('./locales/zh'))
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
    .alias('保存女友')
    .action(async ({ session, options }, text) => {
      try {
        await saveResultToDatabase(session, text)
        session.send(session.text(".saved"))
      } catch (err) {
        session.send(session.text('.saved-error', err.message))
      }
    });

  ctx.command(`gptgf.show`)
    .alias('gptgf.女友信息')
    .alias('女友信息')
    .action(async ({ session }) => {
      const girlfriend = await getCurrentGirlfriend(ctx, session);
      if (girlfriend) {
        await formatData(session, girlfriend);
      }
    });

  ctx.command('gptgf.draw')
    .alias('gptgf.康康女友')
    .alias('康康女友')
    .action(async ({ session }) => {
      const girlfriend = await getCurrentGirlfriend(ctx, session);
      if (girlfriend) {
        const taggedData=await drawImage(ctx,session, girlfriend);
        if ( !('tag' in girlfriend) && taggedData.tag ) {
          await ctx.database.set('girlfriends', { uid: session.uid }, { newGirlfriend: taggedData });
        }
      }
    });

  ctx.command(`gptgf.clothes`)
    .alias('gptgf.女友暖暖')
    .alias('女友暖暖')
    .action(async ({ session }) => {
      const girlfriend = await getCurrentGirlfriend(ctx, session);
      if (girlfriend) {
        try {
          // 随机选择一种服饰
          const clothes = ["连衣裙", "牛仔裤套装", "西装", "T恤和短裤", "背心和短裤", "运动套装", "针织衫和长裤", "迷你裙", "卫衣和运动裤", "运动背心和运动裤", "牛仔夹克和牛仔裤", "连体裤", "运动外套和运动裤", "连衣裤", "短袖衬衫和长裤", "背心和短裙", "吊带裙", "针织衫和短裙", "运动背心和短裤", "连衣短裤", "长袖衬衫和长裤", "迷你半身裙", "背心和连衣裤", "运动外套和短裤", "连体裙", "短袖衬衫和短裤", "中长半身裙", "背心和长裤", "运动上衣和短裤", "吊带连衣裙", "针织衫和长袖裙", "运动背心和长裤", "吊带长裤", "长袖衬衫和短裙", "阔腿裤套装", "连体长裤", "短袖T恤和短裙", "长款连帽卫衣和运动裤", "长袖连衣裙", "民族风连衣裙", "白衬衫和铅笔裙", "高领毛衣和阔腿裤", "休闲运动装", "宽松长裤", "蕾丝连衣裙", "背心和热裤", "学院风套装", "灯笼袖连衣裙", "运动套装", "条纹T恤和牛仔裤", "低胸吊带上衣和短裙", "紧身背心和瑜伽裤", "露脐上衣和迷你裙", "衬衫和长裤", "连衣长裤", "泳装", "雪纺连衣裙", "西装外套和裤子", "军装", "毛衣和短裙", "小吊带和短裙", "针织背心和阔腿裤", "舞蹈服", "包臀裙", "女仆装", "紧身连衣裤", "格子衬衫和牛仔裤", "蝙蝠袖连衣裙", "职业套装", "铅笔裤", "吊带连体裤", "防晒服", "丝绸连衣裙", "皮衣和紧身裤", "短款卫衣和短裤", "蕾丝上衣和长裙", "冬季套装", "吊带连衣裤", "背心和阔腿裤", "毛衣和长裤", "旗袍", "抹胸上衣和短裙", "牛仔短裤和T恤", "棒球服", "皮草大衣和长裤", "裙子套装", "旗袍裤", "棉麻连衣裙"];
          const clothType = clothes[Math.floor(Math.random() * clothes.length)];
          // 生成新的女友信息
          const newGirlfriend = { ...girlfriend, cloth: clothType };

          await drawImage(ctx,session,newGirlfriend, true);
        } catch (err) {
          session.send(err.message);
        }
      }
    });

  ctx.command(`gptgf.date`)
    .alias('gptgf.女友约会')
    .alias('女友约会')
    .action(async ({ session }) => {
      const girlfriend = await getCurrentGirlfriend(ctx, session);
      if (girlfriend) {
        try {
          const format = `{plans:[{"plan":}]}`;
          let reqDateOptions = session.text(`.prompt.baseDateOptions`) + format;
          reqDateOptions += ` age:${girlfriend.age},speciality:${girlfriend.speciality},career:${girlfriend.career},personality:${girlfriend.personality},hobbies:${girlfriend.hobbies}`;
          // console.log(reqDateOptions);
          const optionsRes = await ask(ctx, session, reqDateOptions);
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
          const dateStoryRes = await ask(ctx, session, dataStoryReq);
          // console.log(dateStoryRes);
          const favorability = await updateFavorability(ctx, session, favorScore);
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
              await drawImage(ctx,session, newGirlfriend, true);
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
    .alias('女友决斗')
    .action(async ({ session }, targetUser) => {
      logger.debug('targetUser', targetUser)
      if (!targetUser) {
        await session.send('请 @ 一个玩家来决斗。');
        return;
      }
      const match = targetUser.match(/id="(\d+)" name="(.+?)"/);
      if (!match) {
        await session.send('目标玩家格式不正确，请重新 @ 一个玩家。');
        return;
      }
      
      const opponentId = match[1];
      const opponentName = match[2];
      const opponentUid = `${session.platform}:${opponentId}`;

      if (opponentUid == session.uid) {
        await session.send('请勿左脚踩右脚');
        return;
      }

      let isGlobalInBattle = await checkGlobalBattleStatus(ctx);
      if (isGlobalInBattle) {
        await session.sendQueued('当前已有一场决斗进行中，请稍后再试。', MSG_DELAY);
        return;
      }

      const playerGirlfriend = await getCurrentGirlfriend(ctx, session);
      if (!playerGirlfriend) {
        return;
      }

      const opponentGirlfriend = await getCurrentGirlfriend(ctx, session, opponentUid, opponentName);
      if (!opponentGirlfriend) {
        session.sendQueued('双方都需要拥有女友才能进行决斗。', MSG_DELAY);
        return;
      }
      // const opponentEvent= new Event
      // const opponentSession = new Session(session.bot,session.event);
      session.sendQueued(`${opponentName}, 你被挑战了！回复 "接受" 来接受决斗。（测试版中如遇bug请at咩咩）`, MSG_DELAY);


      let opponentAgreed = false;
      ctx.user(opponentId).once('message', async (msgSession) => {
        if (msgSession.content === '接受') {
          //check again
          isGlobalInBattle = await checkGlobalBattleStatus(ctx);
          if (await checkGlobalBattleStatus(ctx)) {
            await session.sendQueued('当前已有一场决斗进行中，请稍后再试。', MSG_DELAY);
            return;
          }
          opponentAgreed = true;
          await startDuel(ctx, session, msgSession, playerGirlfriend, opponentGirlfriend);
          return;
        } else {
          session.sendQueued('对方拒绝了决斗。', MSG_DELAY);
          return;
        }
      });

      // setTimeout(() => {
      //   if (!opponentAgreed) {
      //     session.send('对方没有在规定时间内回复。');
      //   }
      // }, RESPONSE_TIMEOUT);
    });

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
    logger.debug("gptsd text",text)
    if (!text?.trim())
      return session.execute(`help ${name}`);
    let imageDict: Dict
    text = h('', h.transform(h.parse(text), {
      img(attrs) {
        if (imageDict) throw new Error('.too-many-images')
        imageDict=attrs
        return ''
      },
    })).toString(true)

    const prompt = session.text('.prompt.baseTag', { text });
    logger.debug("gptsd prompt",prompt)
    const regex = /[^a-zA-Z0-9,\s]/g;
    const sdPrompt = (await ask(ctx, session, prompt)).replace(/#/g, ",").replace(regex, '');
    logger.debug("gptsd sdPrompt",sdPrompt)
    if (config.tag) {
      session.send(`tag： ${sdPrompt}`);
    }
    session.permissions.push(`command:${ctx.$commander.get(config.command).name}`)
    if (imageDict){
      logger.debug(`${config.command} ${sdPrompt} `+h('img', imageDict))
      await session.execute(`${config.command} ${sdPrompt} `+h('img', imageDict));
    }else{
      await session.execute(`${config.command} ${sdPrompt}`);
    }
     
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
    const response = (await ask(ctx, session, prompt)).replace(/（可选）/g, '');
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

    const taggedData = await drawImage(ctx,session,data);

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



  

}

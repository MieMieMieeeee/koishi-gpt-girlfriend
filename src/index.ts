import { Context, Logger, Quester, Session, Command, h } from 'koishi'
import { Config } from './config'
import { } from '@mirror_cy/gpt'


export const name = 'gptsd'
export * from './config'

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

declare module 'koishi' {
  interface Tables {
    girlfriends: Girlfriends
  }
}

export interface Girlfriends {
  id: number;
  uid: string;
  currentGirlfriend?: JSON;
  newGirlfriend?: JSON;
  other?: string;
}

export function apply(ctx: Context, config: Config) {
  ctx.i18n.define('zh', require('./locales/zh'))
  ctx.command(`gptsd <prompts:text>`)
    .alias('gpt约稿')
    .alias('智能约稿')
    .action(async ({ session }, text) => {
      await gptsd(session, text)
    });
  ctx.command(`gptgf <prompts:text>`)
    .alias('女友盲盒')
    .action(async ({ session,options  }, text) => {
    session.send(session.text(".init"));
    await gptgf(session, text);
  });

  ctx.command(`gptgf.save <prompts:text>`)
    .alias('gptgf.保存')
    .action(async ({ session,options  }, text) => {
      try {
        // 将结果保存到数据库中
        await saveResultToDatabase(session, text)
        // 发送保存成功的消息
        session.send(session.text(".saved"))
      } catch (err) {
        // 如果执行内部指令发生错误，则发送错误消息
        session.send(session.text('.saved-error', [err.message]))
      }
  });

  ctx.command(`gptgf.show`)
    .alias('gptgf.女友信息')
    .action(async ({ session }) => {
      const existingData = await ctx.database.get('girlfriends', { uid: session.uid });
    
      if (existingData.length > 0) {
        const currentGirlfriend = existingData[0].currentGirlfriend;
        if (currentGirlfriend) {
          // 如果存在女友信息，则发送女友信息给用户
          await formatData(session,currentGirlfriend); 
        } else {
          // 如果当前女友信息为空，则发送消息告诉用户还没有女友信息
          session.send(session.text('.noCurrentGirlfriend'))
        }
      } else {
        // 如果不存在女友信息，则发送消息告诉用户还没有女友信息
        session.send(session.text('.noCurrentGirlfriend'))
      }
  });

  ctx.command('gptgf.draw')
  .alias('gptgf.康康女友')
  .action(async ({ session }) => {
    const existingData = await ctx.database.get('girlfriends', { uid: session.uid });
    
      if (existingData.length > 0) {
        const currentGirlfriend = existingData[0].currentGirlfriend;
        if (currentGirlfriend) {
          // 如果存在女友信息，则发送女友信息给用户
          await drawImage(session, currentGirlfriend);
        } else {
          // 如果当前女友信息为空，则发送消息告诉用户还没有女友信息
          session.send(session.text('.noCurrentGirlfriend'))
        }
      } else {
        // 如果不存在女友信息，则发送消息告诉用户还没有女友信息
        session.send(session.text('.noCurrentGirlfriend'))
      }
  });

  ctx.model.extend('girlfriends', {
    id: 'unsigned',
    uid: 'string',
    currentGirlfriend: 'json',
    newGirlfriend:'json',
    other: 'string',
  }, {
    autoInc: true,
  });

  async function gptsd(session: Session, text: string,) {
    if (!text?.trim())
      return session.execute(`help ${name}`);
    const prompt = session.text('.prompt.baseTag', { text });
    const sdPrompt = await ask(session, prompt);
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
    // const types = ["loli"];
    const type = types[Math.floor(Math.random() * types.length)];
    const prompt = session.text('.prompt.baseAniGirl', { type: generateAge().toString() + "'s " + type });
    console.log(prompt);
    const response = await ask(session, prompt);
    console.log(response);
    const data = JSON.parse(response.match(/{.*}/s)[0]);

    const existingData = await ctx.database.get('girlfriends', { uid:session.uid });

    if (existingData.length > 0) {
      await ctx.database.set('girlfriends', { uid:session.uid }, { newGirlfriend: data });
    } else {
      await ctx.database.create('girlfriends', {
        uid:session.uid,
        currentGirlfriend: undefined, // 现任女友信息为空
        newGirlfriend: data,
        other: undefined,
      });
    }

    await formatData(session,data);    
    
    await drawImage(session, data);
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
      "hobbies": "爱好",
      "background": "背景"
    };

    //筛选输出属性
    const translatedData = {};
    for (const key in data) {
      const translatedKey = translations[key] || key;
      translatedData[translatedKey] = data[key];
    }
    const selectedKeys = ['职业', '特长', '外貌', '爱好', '背景'];
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
    age = age + session.text(age ? ".age": ".ageUnkown") 
    session.send(
      h('quote', { id: session.messageId }) +
      session.text('.newFriend', { age: age, output: output })
    );
  }


  async function ask(session: Session, prompt: string) {
    await ctx.gpt.reset(session.userId);
    return ctx.gpt.ask(prompt, session.userId)
      .then(({ text }) => {
        return text;
      })
      .catch((err) => {
        handleError(session, err);
        return "Hello, World?";
      });
  }

  async function drawImage(session: Session, data: any) {
    let text = data.appearance + " " + data.hobbies + " "+ session.text(".female") + data.career+" ";
    text+=` 发色:${data.hair_color} 瞳色:${data.eye_color}`;
    const promptTag = session.text('commands.gptsd.messages.prompt.baseTag', { text });
    console.log(promptTag) 
    let sdPrompt = await ask(session, promptTag);
    sdPrompt = sdPrompt.replace(/#/g, ",");
    console.log(sdPrompt) 
    await session.execute(`${config.command} ${sdPrompt}`);
  }

  function handleError(session: Session, err: Error) {
    const prefix = 'commands.gptsd.messages'
    console.log(err)
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


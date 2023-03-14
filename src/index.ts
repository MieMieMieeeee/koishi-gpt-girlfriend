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
    .action(async ({ session }, text) => {
      session.send(session.text(".init"))
      await gptgf(session, text)
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

  async function gptgf(session: Session, text: string,) {
    const types = ["Japanese anime", "Chinese", "abnormal anime"];
    // const types = ["loli"];
    const type = types[Math.floor(Math.random() * types.length)];
    const prompt = session.text('.prompt.baseAniGirl', { type: generateAge().toString() + "'s " + type });
    // console.log(prompt);
    const response = await ask(session, prompt);
    // console.log(response);
    const data = JSON.parse(response.match(/{.*}/s)[0]);

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
    
    //画图
    text = data.appearance + " " + data.hobbies + " "+ session.text(".female") + data.career
    // console.log(text)
    const promptTag = session.text('commands.gptsd.messages.prompt.baseTag', { text });
    // console.log(promptTag)
    let sdPrompt = await ask(session, promptTag);
    sdPrompt = sdPrompt.replace(/#/g, "");
    // console.log(sdPrompt)
    await session.execute(`${config.command} ${sdPrompt}`);
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


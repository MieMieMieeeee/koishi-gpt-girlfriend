import { Context, Logger, Quester,Session,Command  } from 'koishi'
import { Config } from './config'
import { } from '@mirror_cy/gpt'

export const name = 'gptsd'
export * from './config'

export const usage = `
## 指令：
- gptsd gpt约稿 智能约稿
  - (beta)用gpt生产tag并直接调用绘画插件绘图
- gptgf 女友盲盒  
  - 不知道说什么？那就随机抽个！
  - (beta beta beta)没怎么测试过，有任何Bug可以去koishi群里@miemiemie
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
          await gptgf(session, text)
        });

  async function gptsd(session: Session ,text: string,){
    if (!text?.trim())
      return session.execute(`help ${name}`);
    const prompt = session.text('.prompt.baseTag', { text });
    const sdPrompt = await ask(session, prompt);
    if (config.tag) {
      session.send(`tag： ${sdPrompt}`);
    }

    //执行绘图
    // session.send(`${config.command} ${sdPrompt}`);
    await session.execute(`${config.command} ${sdPrompt}`);
  }

  async function gptgf(session: Session ,text: string,){
    const prompt = session.text('.prompt.baseAniGirl');
    const response = await ask(session, prompt);
    const start = response.indexOf('{');
    const end = response.indexOf('}');
    const jsonString = response.substring(start, end + 1);
    const data = JSON.parse(jsonString);

    // for (const key in data) {
    //   console.log(`${key}: ${data[key]}`);
    // }

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
    const translatedData = {};

    for (const key in data) {
      const translatedKey = translations[key] || key;
      translatedData[translatedKey] = data[key];
    }

    const selectedKeys = ['职业', '特长','外貌','爱好','背景'];

    
    let selectedData = Object.fromEntries(
      Object.entries(translatedData).filter(([key, value]) => selectedKeys.includes(key))
    );
    selectedData={
      "体型": `${data.height}/${data.weight}`,
      ...selectedData,
    }
    
    const keyValueStrings = Object.entries(selectedData).map(([key, value]) => `${key}: ${value}`);

    const output = keyValueStrings.join("\n");
    session.send(`恭喜你，你今天交到了一个${data.age}美丽的女友！\n${output}`);
    
    text =data.appearance+data.hobbies
    // console.log(text)
    const promptTag = session.text('commands.gptsd.messages.prompt.baseTag', { text });
    let sdPrompt = await ask(session, promptTag);
    sdPrompt = sdPrompt.replace(/#/g, ""); 
    // console.log(sdPrompt)
    await session.execute(`${config.command} ${sdPrompt}`);

    // const sdPrompt = await ask(session, prompt);

    //执行绘图
    // session.send(`${config.command} ${sdPrompt}`);
    // await session.execute(`${config.command} ${sdPrompt}`);
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
    const prefix= 'commands.gptsd.messages'
    
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
      }  else if (err.code === 'ECONNRESET') {
          return session.text(`${prefix}.request-failed`, [err.code])
      } else if (err.code) {
        return session.text(`${prefix}.request-failed`, [err.code])
      } 
    }    
    logger.error(err)
    return session.text(`${prefix}.unknown-error`)
  }
}


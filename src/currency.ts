import { Context, h} from 'koishi'
import { logger } from '.';
import crypto from 'crypto';
import { get } from 'http';

function generateSignature(uid: string, currency: number, goods: JSON): string {
  const hmac = crypto.createHmac('sha256', 'girlfriend');
  hmac.update(uid);
  hmac.update(currency.toString());
  hmac.update(JSON.stringify(goods));
  return hmac.digest('hex');
}

export async function getBalance(ctx: Context, uid: string): Promise<number> {
  const existingData = await ctx.database.get('girlfriends', { uid: uid });
  if (existingData && existingData.length > 0) {
    const currentCurrency = existingData[0].currency || 0;
    if (currentCurrency == 0) {
      return 0;
    }
    const signature = existingData[0].signature;
    const validSignature = generateSignature(uid, currentCurrency, existingData[0].goods);
    if (signature !== validSignature) {
      logger.error(`Currency data has been tampered with for uid: ${uid}`);
      throw new Error('Currency data has been tampered with!');
    }
    return currentCurrency;
  } else {
    return 0;
  }
}

export async function getGoods(ctx: Context, uid: string): Promise<JSON> {
    const existingData = await ctx.database.get('girlfriends', { uid: uid });
    if (existingData && existingData.length > 0) {
        const goods = existingData[0].goods;
        return goods;
    } else {
        return null;
    }
}

export async function addGoods(ctx: Context, uid: string, goodsName: string, goodsId: number): Promise<void> {
    try {
        let goods = await getGoods(ctx, uid);
        if (goods.hasOwnProperty(goodsName)) {
            goods[goodsName].quantity += 1;
        } else {
            goods[goodsName] = {
                quantity: 1,
                id: goodsId
            };
        }
        const signature = generateSignature(uid, await getBalance(ctx,uid), goods);
        await ctx.database.set('girlfriends', { uid: uid }, { goods: goods, signature: signature});
    } catch (error) {
        logger.error(`Error adding goods for uid: ${uid}`, error);
        throw error;
    }
}

export async function removeGoods(ctx: Context, uid: string, goodsName: string)
    : Promise<{suceess:boolean,reason:string}> {
    const result={suceess:false,reason:""};
    const goods = await getGoods(ctx, uid);
    if (goods.hasOwnProperty(goodsName)) {
        if (goods[goodsName].quantity >= 1) {
            goods[goodsName].quantity -= 1;
            const signature = generateSignature(uid, await getBalance(ctx, uid), goods);
            await ctx.database.set('girlfriends', { uid: uid }, { goods: goods, signature: signature });
            result.suceess=true;
            return result
        } else {
            result.reason=`您的背包中 ${goodsName} 数量不足`;
            logger.debug(`Goods ${goodsName} quantity is 0 for uid: ${uid}`);
        }
    } else {
        result.reason=`您的背包中不存在 ${goodsName}`;
        logger.debug(`Goods ${goodsName} does not exist for uid: ${uid}`);
    }
}

export async function addCurrency(ctx: Context, uid: string, amount: number): Promise<number> {
    try {
        const currentCurrency = await getBalance(ctx, uid);
        const newCurrency = Math.min(Number.MAX_SAFE_INTEGER/10, currentCurrency + amount);
        const signature = generateSignature(uid, newCurrency, await getGoods(ctx, uid));
        await ctx.database.set('girlfriends', { uid: uid }, { currency: newCurrency, signature: signature });
        return newCurrency;
    } catch (error) {
        logger.error(`Error adding currency for uid: ${uid}`, error);
        throw error;
    }
}

export async function removeCurrency(ctx: Context, uid: string, amount: number): Promise<number> {
    try {
        const currentCurrency = await getBalance(ctx, uid);
        if (currentCurrency >= amount) {
            const newCurrency = currentCurrency - amount;
            const signature = generateSignature(uid, newCurrency, await getGoods(ctx, uid));
            await ctx.database.set('girlfriends', { uid: uid }, { currency: newCurrency, signature: signature });
            return currentCurrency;
        } else {
            return -1; // Insufficient balance
        }
    } catch (error) {
        logger.error(`Error deducting currency for uid: ${uid}`, error);
        throw error;
    }
}

export async function transferCurrency(ctx: Context, fromUid: string, toUid: string, amount: number): Promise<void> {
    try {
        // 从一个用户的账户转移货币到另一个用户的账户
        const fromCurrency = await getBalance(ctx, fromUid);
        const toCurrency = await getBalance(ctx, toUid);
        if (fromCurrency >= amount) {
            const newFromCurrency = fromCurrency - amount;
            const newToCurrency = Math.min(Number.MAX_SAFE_INTEGER/10, toCurrency + amount);
            await Promise.all([
                ctx.database.set('girlfriends', { uid: fromUid }, { currency: newFromCurrency }),
                ctx.database.set('girlfriends', { uid: toUid }, { currency: newToCurrency })
            ]);
        } else {
            logger.error(`Insufficient balance for uid: ${fromUid}`);
        }
    } catch (error) {
        logger.error(`Error transferring currency from uid: ${fromUid} to uid: ${toUid}`, error);
        throw error;
    }
}

export async function getStore(ctx: Context, uid: string){
    const existingData = await ctx.database.get('girlfriends', { uid: uid },['store']);
    const store = existingData[0].store;
    const currentDate = new Date().toISOString().split('T')[0];
    if (!store.storeDate || store.storeDate !== currentDate) {
        await refreshStore(ctx, uid);
        const existingDataAfterRefresh = await ctx.database.get('girlfriends', { uid: uid },['store']);
        return existingDataAfterRefresh[0].store;
    }
    return store;
}

export async function refreshStore(ctx: Context, uid: string) {
    const store = {}
    const currentDate = new Date().toISOString().split('T')[0];
    store["storeDate"] = currentDate
    store["storeGoods"] = { '定制盲盒': { quantity: 20, price: 50, id: 1 } };
    await ctx.database.set('girlfriends', { uid: uid }, {store: store});
    return;
}

export async function buyGoods(ctx: Context, uid: string, goodsName: string): Promise<string> {
    try {
      const store = await getStore(ctx, uid);
      const goods = store.storeGoods;
      if (!goods.hasOwnProperty(goodsName)) {
        return `商品 ${goodsName} 在商店中不存在`;
      }
  
      const userCurrency = await getBalance(ctx, uid);
      if (userCurrency < goods[goodsName].price) {
        return `你的金币不足以购买 ${goodsName}`;
      }
  
      if (goods[goodsName].quantity <= 0) {
        return `商品 ${goodsName} 已售罄`;
      }
  
      await removeCurrency(ctx, uid, goods[goodsName].price);
  
      // 更新库存
      goods[goodsName].quantity -= 1;
      await ctx.database.set('girlfriends', { uid: uid }, { store: {
            storeDate:store.storeDate,
            storeGoods: goods
        } });
  
      // 给用户添加商品
      await addGoods(ctx, uid, goodsName,goods[goodsName].id);
  
      return `购买成功！`;
    } catch (error) {
      logger.error(`购买商品时出错，uid: ${uid}`, error);
      return `购买商品时出错！${error}`;
    }
  }
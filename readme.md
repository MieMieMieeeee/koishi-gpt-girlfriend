# @miemiemie/koishi-plugin-gpt-girlfriend

[![npm](https://img.shields.io/npm/v/@miemiemie/koishi-plugin-gpt-girlfriend?style=flat-square)](https://www.npmjs.com/package/@miemiemie/koishi-plugin-gpt-girlfriend)

## （beta）koishi女友盲盒 
- 随机抽取你的女友（含图）
- 莫名其妙地写了换装和约会功能
- 莫名其妙地写了决斗功能（实验性）
- 省流，快速使用指南
  - 安装@miemiemie/gpt-api插件
    - 请准备好gpt的官方或者非官方apikey（将非官方地址填入反向代理的配置）
  - 安装rr2插件（画图也可以换为novelai）
- 有任何Bug,或者建议可以去koishi群里@miemiemie
  
## 指令：
- 女友盲盒  
  - 不知道说什么？那就随机抽个！
  - 全部功能请通过以下指令查看
    - help 女友盲盒

![demo](https://raw.githubusercontent.com/MieMieMieeeee/koishi-gpt-girlfriend/main/img/demo.png)
- 智能约稿
  - 用gpt生产tag并直接调用绘画插件绘图

![demo](https://github.com/MieMieMieeeee/koishi-gpt-girlfriend/blob/main/img/demo_gptsd.png) 


## 粗糙的更新日志
- 0.3.18 增加一个画图指令的配置项，同时支持新版koishi(4.17.12)
- 0.3.17 增加了定制盲盒，可从女友商店中购买
- 0.3.16 增加了可有可无的签到功能，以及可以重置决斗状态了
- 0.3.15 智能约稿支持图生图（仅限使用的画图指令支持图生图的情况下）
- 0.3.14 尝试修复了女友盲盒有时候会生成英文描述的问题，女友决斗的一些小改动
- 0.3.13 即使用户没有画图插件的权限也可以通过本插件的指令内部调用画图了
- 0.3.10 女友决斗技能伤害修改
- 0.3.9 女友决斗bug修复
- 0.3.0 女友约会更容易提升好感度，增加指令女友决斗（实验性,可能bug巨多）
- 0.2.7 适配新版gpt-3.5模型，以及女友约会更容易提升好感度
- 0.2.6 bug修复
- 0.2.5 bug修复，添加好感度的隐藏福利（?）
- 0.2.3 增加女友约会功能（实验性）
- 0.2.2 bug修复
- 0.2.0 增加女友保存,换装功能（实验性，之后功能可能会有所调整）
- 0.1.7 算法优化
- 0.1.6 增加了一些女友的种类（待反馈），添加年龄算法
- 0.1.5 gptgf指令下，群聊回复时引用对话
- 0.1.4 修正了一些女友的属性（逐步调整ing）
- 0.1.0 添加了女友盲盒的功能

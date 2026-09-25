# 更新记录

## v2.4.0（2026-09-26）：打磨与省钱

### 改进

- 切换界面语言后，如果已有分析是另一种语言写的，底部会提示「重新分析会用新语言」，并显示预计花费；不会自动重跑。一次分析中途切换语言，这次分析仍统一用开始时的语言。
- 长聊天更省钱：分批分析时只有第一批写整体解读，其余批次不再重复写，输出 token 更少；预计花费也按此计算。
- 英文界面：单复数（1 message / 2 messages）、千位分隔符按界面语言显示；「撤回了一条消息」「拍了拍」在英文界面显示为 recalled / nudged；弹窗标题统一首字母大写。
- 出错提示和状态提示会跟着切换语言一起变；断网、超时等浏览器报错改成易懂的提示。
- 判断依据和整体解读的长度上限按字符宽度计算，英文不再被过早截断，截断时在单词边界处加「…」。
- 导入时有几行认不出发言人，会明确提示在前面加「名字：」。
- 无障碍：页面语言标记在首次渲染前就设置好；语言按钮带 lang 和按下状态；非中英文浏览器按系统语言列表选择。

### 修复

- 搜索结果和关键时刻里，没有秒数的时间（如 21:03）会被错误截成「21」。
- 导出报告里中文日期（如 2026年8月1日）的日期范围被截断。
- 回复详情里评分后多出一个「 · 」。

### 其他

- `启动.bat`：更新到新版本后依赖有变化时会自动重新安装；端口跟随 `.env` 里的 PORT。
- `npm run release`：推送前先检查 gh 是否已登录、本地是否落后于 GitHub，避免只推了标签却没建 Release。
- README 加上真实界面截图，中英文说明同步；`.env.example` 补充 LLM_PARALLEL 说明；包名改为 crush-monitor-universal。

### English summary

- After switching the interface language, results written in the other language get a re-run offer with the estimated cost (never automatic).
- Long chats cost less: only the first batch writes the overall reading.
- English polish: plurals, number formatting, translated recall/nudge notices, title-case dialog names; errors re-render in the current language.
- Fixes: times without seconds were cut to the hour in search and key moments; Chinese dates in the report's date range; a stray separator in reply details.
- Screenshots in the README, safer release script, and `启动.bat` reinstalls dependencies after an update and honors PORT from `.env`.

## v2.3.0（2026-09-26）：全英文使用

### 新增：切到 English 后，模型也用英文回答

- 判断依据、整体解读、关系走势里每周的总结，都会用自然的英文写，把你称为 you、对方称为 they。
- 回复建议：改写始终和你原来那句用同一种语言（英文聊天就给英文改写，不管界面是什么语言）；「为什么这样改」按界面语言写。
- 模型会按聊天本身的语言理解网聊习惯，例如英文里的 lol、haha、k、句末句号显得冷淡、emoji 等。
- 英文界面的「Try a sample chat」换成一段英文示例聊天；导入时名为「Me」的一方会被默认选为自己。
- 切换语言不会自动重新分析：已有结果保留原来的语言，之后的新分析用当前语言，所以切换不花钱。
- 判断标准和打分规则没有变化，中文界面的效果和之前一样。

### 翻译调整

- 暧昧中 → Talking stage（说明：双方有好感、可能发展成情侣，但还没确定关系）
- 恋爱中 → In a relationship，冷战 / 闹别扭 → Fighting / silent treatment，分手后 / 前任 → Exes
- 试探好感 → Gauging interest，重新靠近 → Warming up again，表达心意 → Confessing feelings

## v2.2.0（2026-09-25）：中英双语界面

### 新增：中文 / English 界面切换

- 整个界面都有中英两种语言：按钮、提示、情绪和意图标签、好感维度、回复评级说明、关系类型、关键时刻、设置、花费、免责声明、导出的报告，以及后台返回的出错提示。
- 右上角的「EN / 中」按钮一键切换，设置里也可以选；切换后立即生效，不用刷新页面。手机上只在设置里切换。
- 语言选择保存在本机浏览器；第一次打开时，浏览器是中文就显示中文，其他语言显示英文。
- 导出的分析报告使用导出时的界面语言。

### 说明

- 只翻译界面文字。你导入的聊天内容保持原样；模型写的判断依据、整体解读和改写建议目前仍是中文。
- 发给模型的判断标准没有改动，已有的分析结果不需要重新分析。

### 改进

- 手机上顶部的好感度不再和右侧图标重叠。
- 导入英文聊天时，名为「Me」的一方会被默认选为自己。

### 开发

- 所有界面文字集中在 src/locales/zh.ts 和 en.ts；英文文件的类型由中文文件推导，漏翻或多出的 key 会直接编译失败。
- 新增 npm run release：检查、打版本标签、推送，并按 CHANGELOG 里对应的一节创建 GitHub Release。
- 界面测试新增英文环境：默认英文、完整分析、切到中文再切回、刷新后记住选择。

## v2.1.0（2026-09-25）

### 新增：可以切回原版的 Jev 模型

- 设置「模型与接口」里可以在「DeepSeek / OpenAI」和「Jev（原版模型）」之间切换。
- Jev 支持三个调用平台：OpenRouter、Vercel AI Gateway、TypeSafe 官方。每个平台的 Key 分开保存，切换不会串用；把 OpenRouter 的 Key 填到别的平台下时会提示。
- Jev 模式可选「仅 Jev」或「Jev + DeepSeek / OpenAI」：Jev 只打分、不写句子，选后者时「这句可以怎么说更好」的回复建议由 DeepSeek / OpenAI 来写。
- 「保存并测试连接」在 Jev + DeepSeek / OpenAI 模式下两边都测，哪边出问题会分别说明。
- Jev 给出的是经过校准的概率，但不写判断理由，所以 Jev 模式下没有「判断依据」和「整体解读」。

### 长聊天自动分批

- Jev 沿用原版的上限：一次最多 500 条 / 12,000 字，同时最多 2 个请求。更长的聊天会自动分批上传，逐句分析和关系走势覆盖全部消息，整体好感读最近的部分。
- 开始前会提示「超过单次上限，将分批上传」；分析时底部显示「正在分析第 x–y 条，共 N 条」。

### 花费

- DeepSeek / OpenAI 和 Jev 各有一套单价和账单校准，互不影响。
- Jev 的实际价格以平台账单为准，预计花费只作参考，页面上会注明。

### 改进与修复

- 分析进行中不能保存模型设置，避免一次分析中途换模型。切换模型后，已经分析过的消息保留原来的结果，之后的新消息和整体判断用新模型；设置里切换时会说明这一点。
- 页面等设置读取完成后才给出预计花费和「开始分析」，避免按错误的上限分批。
- 首次打开「使用前请阅读」时去掉了不起作用的关闭按钮。
- Jev 请求超时或回复中途断开会自动重试；返回内容完全无法使用时会报错，不会悄悄显示成「信息不足」，也不会写入缓存。
- 出错提示按所用模型给出具体建议（例如 Vercel 需要先绑定信用卡）。
- 模型返回的 JSON 里没有答案时会重新请求，不再把空结果缓存 30 天（DeepSeek / OpenAI 模式原有问题）。
- 修复手机上底部状态栏被挤成窄条的问题。
- 修复设置页未保存的单价在切换模型时丢失、隐藏的输入框里的 Key 被一并提交等问题。

### 开发

- 界面测试（`npm run test:e2e`）新增 Jev 模式：本地模拟 Jev 的原生接口，完整跑通分析、长聊天分批，并检查每次请求不超过原版上限、同时不超过 2 路。
- 测试服务器固定了全部设置，不会读取开发者自己的 `.env`，避免误用真实 Key 花钱。
- `.env.example` 新增 `LLM_PROVIDER`、`JEV_PLATFORM`、`OPENROUTER_API_KEY`、`AI_GATEWAY_API_KEY`、`TYPESAFE_API_KEY`、`JEV_SUGGEST`；测试用的 `JEV_ENDPOINT` 只能通过环境变量设置。

### 升级提示

- 更新代码后请关掉旧的启动窗口（黑色窗口）再重新打开，然后刷新网页。
- 已有的 `.env` 不需要修改，默认仍使用 DeepSeek / OpenAI；想用 Jev 在网页设置里切换即可。

## v2.0.0（2026-09-24）

首个公开版本：基于 [FerryCorleone/crush-monitor](https://github.com/FerryCorleone/crush-monitor) 改编，经原作者同意后发布。模型接口改为 DeepSeek / OpenAI 兼容接口，并新增判断依据、关系走势、关键时刻、回复建议、报告导出、花费统计、隐私打码、网页内设置等功能，详见 README。

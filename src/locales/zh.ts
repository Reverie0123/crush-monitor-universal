// All interface text in Chinese. en.ts must have exactly the same keys: its
// type is derived from this object, so a missing or extra key fails to compile.
// Text the model reads (criteria, relationship notes) lives in shared/ and is
// reused here where the page shows it, so the two can never drift apart.
import { INTENTS } from "../../shared/intents";
import { EMOTIONS } from "../../shared/labels";
import { EVENT_KINDS } from "../../shared/memory";
import type { Level } from "../../shared/plan";
import { REPLY_RATINGS } from "../../shared/ratings";
import { AFFINITY_DIMENSIONS } from "../../shared/affinity";
import {
  ACTIONS,
  RELATION_INFO,
  STAGES,
  type Relation,
} from "../../shared/types";

// Every registry key must have text here (and so, through the type, in en.ts).
type Keys<T> = Record<keyof T, string>;
type DimensionKey = (typeof AFFINITY_DIMENSIONS)[number]["key"];
type RatingLabel = (typeof REPLY_RATINGS)[number]["label"];

type Intent = keyof typeof INTENTS;
const intentHints = Object.fromEntries(
  Object.entries(INTENTS).map(([k, v]) => [k, v.criteria]),
) as Record<Intent, string>;
const relationHints = Object.fromEntries(
  Object.entries(RELATION_INFO).map(([k, v]) => [k, v.context]),
) as Record<Relation, string>;

const num = (n: number) => n.toLocaleString("zh-CN");

export const zh = {
  lang: "zh-CN",
  switchTo: "EN",
  switchLabel: "Switch to English",
  appTitle: "好感监控器",
  me: "我",
  other: "对方",
  close: "关闭",
  reasoning: "判断依据",
  pending: "待判断",
  dash: "—",
  colon: "：",
  quote: (s: string) => `「${s}」`,
  points: (n: number | string) => `${n} 分`,
  yuan: (v: number) =>
    v < 0.01 ? "不到 ¥0.01" : `约 ¥${v < 1 ? v.toFixed(2) : v.toFixed(1)}`,
  yuanShort: (v: number) =>
    v < 0.01 ? "不到¥0.01" : `¥${v < 1 ? v.toFixed(2) : v.toFixed(1)}`,
  tokens: (n: number) =>
    n >= 10000 ? `${(n / 10000).toFixed(n >= 1e6 ? 0 : 1)} 万` : String(n),

  emotions: {
    happy: "开心",
    confused: "疑惑",
    angry: "愤怒",
    sad: "难过",
    shy: "害羞",
    caring: "关心",
    teasing: "调侃",
    calm: "平静",
    annoyed: "不耐烦",
    surprised: "惊讶",
    disappointed: "失落",
    unknown: "难判断",
  } satisfies Keys<typeof EMOTIONS>,
  intents: {
    share: "分享近况",
    answer: "回答问题",
    inform: "告知信息",
    ask: "询问信息",
    clarify: "确认理解",
    explain: "解释说明",
    academic: "学术讨论",
    opinion: "表达观点",
    agree: "表示认同",
    disagree: "表达异议",
    acknowledge: "回应收到",
    continue: "延续话题",
    change: "转移话题",
    joke: "玩笑逗趣",
    vent: "倾诉烦恼",
    comfort_seek: "寻求安慰",
    validation: "寻求认同",
    help: "请求帮助",
    advice: "提供建议",
    care: "表达关心",
    comfort: "安慰支持",
    praise: "赞美欣赏",
    thanks: "表达感谢",
    apologize: "道歉修复",
    attention: "寻求关注",
    interest: "试探好感",
    invite_hint: "试探邀约",
    invite: "发出邀约",
    flirt: "暧昧逗弄",
    affection: "表达在意",
    ease: "缓和气氛",
    refuse: "婉拒提议",
    boundary: "表达边界",
    close: "结束聊天",
    other: "其他意图",
    unknown: "难以判断",
  } satisfies Record<Intent, string>,
  intentHints,
  dimensions: {
    initiative: "主动延续",
    engagement: "回应投入",
    care: "关心体贴",
    openness: "自我开放",
    intimacy: "亲密表达",
    action: "实际行动",
  } satisfies Record<DimensionKey, string>,
  ratings: {
    SSS: "非常出彩，表达自然且精准接住语境",
    SS: "优秀，兼顾情绪、分寸和话题延续",
    S: "很好，有效回应且让交流更顺畅",
    A: "合适，回应自然且照顾语境",
    B: "基本合适，但表达还有提升空间",
    C: "较弱，可能接话生硬或忽略对方情绪",
    D: "不合适，可能造成压力、冒犯或难以继续交流",
  } satisfies Record<RatingLabel, string>,
  judgment: {
    insufficient: "信息不足",
    clear: "判断较明确",
    ambiguous: "有歧义",
  },
  relations: {
    new: "刚认识",
    friend: "普通朋友",
    secret: "我单方面有好感",
    crush: "暧昧中",
    pursuing: "我在追对方",
    pursued: "对方在追我",
    couple: "恋爱中",
    cold: "冷战 / 闹别扭",
    ex: "分手后 / 前任",
    reconcile: "想复合",
  } satisfies Record<Relation, string>,
  relationGroups: {
    认识阶段: "认识阶段",
    心动: "心动",
    恋爱: "恋爱",
    分开后: "分开后",
  } as Record<string, string>,
  relationHints,
  stages: {
    unknown: "信息不足",
    contact: "刚搭上线",
    flow: "聊得起来",
    flirt: "出现暧昧",
    date: "有具体约会安排",
    mutual: "明确互表心意",
  } satisfies Keys<typeof STAGES> as Record<string, string>,
  actions: {
    continue: { label: "顺着聊", detail: "接住刚才的话题，别急着切换频道。" },
    ask: {
      label: "轻轻追问",
      detail: "问一个具体、容易回答的小问题，把球轻轻递过去。",
    },
    empathize: {
      label: "先接情绪",
      detail: "先回应对方的感受，再考虑讲道理或给建议。",
    },
    flirt: {
      label: "轻轻调情",
      detail: "顺着已经被接住的玩笑，留一点刚刚好的暧昧。",
    },
    invite: {
      label: "试着约一下",
      detail: "把共同兴趣变成一个具体、没有压力的小邀约。",
    },
    clarify: {
      label: "直接问清",
      detail: "这句话有不止一种理解，温和确认比反复猜更有效。",
    },
    wait: {
      label: "等对方接球",
      detail: "球已经递出去了。先留一点空间，不用急着补发。",
    },
    close: {
      label: "今天先收尾",
      detail: "让聊天停在舒服的位置，下次还有话可说。",
    },
    respect: {
      label: "尊重边界",
      detail: "对方表达了拒绝或需要空间。尊重这个意思，停止推进。",
    },
    insufficient: {
      label: "再多一点上下文",
      detail: "这几句话还看不准，补上前后文再一起看看。",
    },
  } satisfies Record<keyof typeof ACTIONS, unknown> as Record<
    string,
    { label: string; detail: string }
  >,
  levels: {
    quick: {
      label: "快速",
      detail: "只看整体好感、各维度、走势和下一步建议，不逐句分析，最省钱",
    },
    standard: {
      label: "标准",
      detail: "在快速的基础上，逐句分析对方消息的情绪和意图",
    },
    full: {
      label: "完整",
      detail: "在标准的基础上，再给你自己的每条回复打分、写评价",
    },
  } satisfies Record<Level, { label: string; detail: string }>,
  moments: {
    boundary: "拒绝 / 划清界限",
    reopen: "重新靠近",
    invitation: "邀约",
    confirmation: "确认安排",
    cancellation: "取消安排",
    care: "关心",
    preference: "说出喜好",
    disclosure: "敞开心扉",
    commitment: "表达心意",
    question: "提问",
    correction: "澄清",
    none: "",
  } satisfies Keys<typeof EVENT_KINDS>,
  /** Trend period names are stored in Chinese; shown per language. */
  week: (date: string) => `${date} 那周`,
  weekShort: (date: string) => date,
  part: (k: string) => `第${k}段`,

  app: {
    noSuggestJevOnly:
      "当前是「仅 Jev」模式，没有回复建议；可在设置里改成「Jev + DeepSeek / OpenAI」。",
    noSuggestKey:
      "写回复建议需要 DeepSeek / OpenAI 的 API Key，请在设置里填写。",
    avatarSaveFailed: "头像保存失败，可能存储空间不足。",
    storageReadFailed:
      "本机记录读取失败，请检查浏览器存储权限。为避免覆盖旧记录，暂不自动保存。",
    storageSaveFailed:
      "本机保存失败，可能存储空间不足。当前页面仍可使用，请勿刷新以免丢失未保存记录。",
    nothingNew: "没有新增消息，这段已经导入过了。",
    pasteTooLong: "这次粘贴超过25万字符，请分几次追加；历史记录不会被截断。",
    clearFailed: "本机记录删除失败，请重试清空。",
    suggestFailed: "生成失败",
    wechat: "微信聊天",
    rail: "聊天工具",
    scrollLatest: "滚动到最新聊天",
    chatSettings: "聊天设置",
    emptyTitle: "粘贴聊天记录",
    emptyBody: "支持微信、QQ 复制记录及 WhatsApp 文本导出",
    tryExample: "用一段示例试试",
    myPerformance: "我的发挥",
    nextStep: "下一步",
    waitingImport: "等你导入聊天",
    trendTitle: "关系走势",
    trendNote:
      "每个点是这段时间的好感信号评分，只看这段时间和一点前文。变化超过 10 分的地方标出了涨跌，点圆点或原话可跳到聊天里对应的位置。",
    momentsTitle: "关键时刻",
    clearTitle: "开始新的聊天？",
    clearBody: "当前聊天、分析和本机保存的记录都会删除。",
    clearConfirm: "开始新聊天",
    clearKeep: "保留当前聊天",
  },
  header: {
    viewAffinity: "查看好感度详情",
    affinity: "好感度",
    search: "搜索与筛选",
    trend: "关系走势",
    moments: "关键时刻",
    report: "导出分析报告",
    newChat: "新聊天",
    more: "更多聊天设置",
  },
  composer: {
    label: "粘贴聊天记录",
    placeholderEmpty: "在这里粘贴聊天记录…",
    placeholderMore: "粘贴新的聊天，自动合并重复记录",
    fileTitle:
      "选择导出的 .txt 聊天记录；同一个人的记录可以多次导入，重复部分会自动合并",
    importFile: "导入文件",
    importChat: "导入聊天",
  },
  status: {
    limit: (messages: number, chars: number) =>
      `${num(messages)} 条 / ${num(chars)} 字`,
    ranges: { all: "全部", week: "最近 7 天", month: "最近 30 天" },
    lessThanMinute: "不到 1 分钟",
    minutes: (n: number) => `约 ${n} 分钟`,
    level: "分析档位",
    range: "分析范围",
    rangeTitle: "逐句分析只看这段时间；整体好感始终读完整聊天",
    analyzing: (done: number, total: number) => `正在分析 ${done}/${total}`,
    remaining: (eta: string) => ` · 剩余${eta}`,
    spentSoFar: (cost: string) => ` · 本次已花${cost}`,
    ofEstimate: (cost: string) => ` / 预计${cost}`,
    stop: "停止",
    batchRunning: (limit: string) =>
      `聊天已超过单次上限（${limit}），分批上传中`,
    batchRange: (from: number, to: number, count: number) =>
      `：正在分析第 ${num(from)}–${num(to)} 条，共 ${num(count)} 条`,
    capped: (budget: number) => `已达到单次花费上限 ¥${budget}，已暂停。`,
    incomplete: "分析未完成，",
    stale: "当前显示的是旧版规则的结果，",
    langChanged: "现有的分析是英文写的，重新分析会用中文，",
    pendingLines: (n: number) => `待分析 ${num(n)} 条`,
    overviewOnly: "只做整体分析",
    batchHintTitle: (limit: string) =>
      `一次最多读 ${limit}：逐句分析和走势分批覆盖全部消息，整体好感只读最近的部分。`,
    batchHintBig: "（超过单次上限，将分批上传）",
    batchHintSmall: "（超过单次上限，整体只读最近部分）",
    estimate: (cost: string) => ` · 预计${cost}`,
    jevBill: "（Jev 以平台账单为准）",
    startTitle: (requests: number, input: string, output: string) =>
      `约 ${num(requests)} 次分析请求，输入约 ${input}、输出约 ${output} tokens。按设置里的单价估算，并按过去几次的实际用量自动修正；实际以服务商账单为准。`,
    resume: "继续分析",
    start: "开始分析",
    done: "分析完成",
    forFun: "娱乐参考",
    retrying: (n: number) => `正在重试 ${n} 条…`,
    retryOnly: (n: number, cost: string) =>
      `只重试这 ${num(n)} 条未完成的（${cost}）`,
    spendTitle: "查看花费明细、设置单次上限，或按实际账单校准",
    spent: (cost: string) => `已花费 ${cost}`,
    noKey: "还没有设置 API Key，点这里填写",
  },
  line: {
    emotionTitle: "情绪与意图",
    replyTitle: "回复评价",
    emotion: "情绪",
    intent: "意图",
    intentPending: "意图尚未分析。",
    distributionNote:
      "两行分别展示主要情绪与主要沟通意图的候选解读，不代表测量真实内心。每行最多显示前三项，保留原始概率，不重新凑成 100%。",
    replyRating: (label: string) => `回复评级：${label}`,
    noContext: "当前语境不足以判断表达质量",
    replyScore: (value: string) => `回复评分 ${value} / 100`,
    rephrase: "换个说法",
    thinking: "正在想…",
    tryAgain: "再换两种说法",
    howBetter: "这句可以怎么说更好？",
    yourNote: "你的说明",
    editNote: "修改说明，再判断一次",
    wrong: "判断不对？告诉模型实际情况",
    noteLabel:
      "这句话实际是什么意思？（只有你知道的背景，比如「这是我们之间的梗」「她在开玩笑」）",
    reconsidering: "正在重新判断…",
    reconsider: "按我的说明重新判断",
    reconsiderNote:
      "只重新分析这一句，调用一次模型，通常不到一分钱。你的说明会被记住，以后重新分析时也会用上。",
    disclaimer: "结合当前已导入的上下文判断，不代表对方真实想法。",
  },
  row: {
    pendingTip: "点底部的「开始分析」统一分析，开始前会先显示预计花费",
    analyzing: "分析中",
    pending: "待分析",
    systemTip: "系统提示，不单独分析，仅作为上下文参考",
    // System notices are stored in Chinese; zh shows them as they are.
    recalled: null as ((self: boolean) => string) | null,
    nudged: null as ((who: string, whom: string) => string) | null,
    unreadableTip: "看不到具体内容，不单独分析，仅作为上下文参考",
    retryTip: "模型这次没有给出完整结果，可以单独重试这一条",
    retry: "未完成，重试这条",
    emotion: "情绪",
    intent: "意图",
    emotionAria: (label: string, pct: string, text: string) =>
      `${label} ${pct}，查看情绪分析：${text}`,
    intentAria: (label: string, pct: string, text: string) =>
      `${label} ${pct}，查看意图分析：${text}`,
    replyAria: (text: string) => `查看回复评价：${text}`,
    replyRating: "回复评级：",
    noteTip: (note: string) => `你的说明：${note}`,
    corrected: "已按你的说明重新判断",
    skippedTooLong: "单条超过12,000字，已保存，请拆分后分析",
  },
  overview: {
    titles: { overview: "好感度", action: "下一步", performance: "我的发挥" },
    staleNote:
      "这是旧版分析规则的结果，仅供查看。点底部「开始分析」可以按新规则重新分析。",
    reading: "模型的整体解读",
    scoreNote:
      "0—100 是模型对这段聊天的好感信号评分，不是「对方喜欢你的概率」。",
    basisNote:
      "根据近期对话和相关历史原话评分，旧分数不参与计算。证据少时仍保留分数供娱乐参考。",
    history: "参考的历史原话",
    dimAria: (label: string, value: string) => `${label} ${value} 分`,
    weight: (w: number, status: string) => `占 ${w}% · ${status}`,
    boundaryCap: (raw: string) =>
      `对方表达了明确且仍有效的拒绝边界。综合原分 ${raw}，最终好感度最多显示 25 分。`,
    verdict: (status: string, pct: string) =>
      `本轮判断：${status}。综合确定度 ${pct}。`,
    waiting: "等待聊天",
    waitingDetail: "导入后生成建议。",
    performanceNote:
      "已完成分析的我方回复平均分。模型根据发出时的前文评价表达质量，再按固定分数区间显示评级。「快速」「标准」档不给你的回复打分。",
    ratingRange: (label: string, range: string) => `${label} · ${range} 分`,
  },
  settings: {
    title: "聊天设置",
    relation: "你们的关系",
    note: "关系背景（选填，帮助模型理解语气）",
    notePlaceholder:
      "例如：高中同学，认识三年；她打字一向很简短，不爱用表情；最近在准备考研比较忙",
    saveNote: "保存背景",
    swap: "交换双方身份",
    clear: "清空聊天，重新开始",
    disclaimer: "免责声明与风险提示",
    saved: (n: number) =>
      `已保存 ${num(n)} 条聊天。记录保存在本机浏览器，刷新后可继续；分析时只发送所需片段给模型服务。改关系或背景后，底部会重新显示预计花费，确认后再分析。`,
    avatars: "头像",
    avatarNote:
      "图片会裁成正方形并压缩后保存在本机浏览器，不会发给模型；清空聊天时保留。",
    model: "模型与接口",
    language: "界面语言",
    version: (v: string) => `版本 ${v} · 通用版`,
  },
  avatar: {
    change: (who: string) => `更换${who}的头像`,
    clickToChange: "点击更换头像",
    replace: "更换",
    upload: "上传图片",
    reset: "恢复默认",
    unreadable: "这张图片读不出来，换一张试试",
  },
  model: {
    typesafe: "TypeSafe 官方",
    loadFailed: "读取设置失败，请确认启动窗口还开着",
    loading: "正在读取设置…",
    openrouterKey: "这看起来是 OpenRouter 的 Key，请把调用平台选成 OpenRouter",
    savingTest: "正在保存并测试连接…",
    saving: "正在保存…",
    saveFailed: "保存失败",
    saved: "已保存，立即生效",
    connected: (model: string, seconds: string) =>
      `连接成功：${model}，用时 ${seconds} 秒`,
    failed: (reason: string) => `连接失败：${reason}`,
    noReply: "模型没有按要求回复",
    cacheCleared: "已清除本地缓存的分析结果",
    suggestKey: "回复建议用的 API Key（DeepSeek / OpenAI）",
    apiKey: "API Key",
    keySet: (hint: string) => `已设置（${hint}），留空则不修改`,
    pasteKey: "粘贴你的 API Key",
    baseURL: "接口地址",
    modelName: "模型",
    effort: "推理强度",
    effortNone: "不设置（DeepSeek 选这个）",
    temperature: "随机度（temperature，留空用默认；越低结果越稳定）",
    analysisModel: "分析用的模型",
    jevOriginal: "Jev（原版模型）",
    switchNote:
      "保存后切换。已经分析过的消息保留原来的结果，之后的新消息和整体判断用新模型。",
    jevPlatform: "Jev 调用平台",
    jevNoteApply: "在",
    jevNoteRest:
      "申请 Key。Jev 是原作者使用的 TypeSafe 判断模型，给出的概率经过专门校准，但不写判断理由。一次最多读 500 条 / 12,000 字，更长的聊天会自动分批上传（逐句分析覆盖全部消息，整体好感只读最近的部分）。Jev 按平台规则计费，下面的单价估算仅供参考。",
    platformKey: (platform: string) => `${platform} API Key`,
    suggestions: "回复建议",
    jevOnly: "仅 Jev",
    jevPlus: "Jev + DeepSeek / OpenAI",
    jevPlusNote:
      "分析用 Jev；「这句可以怎么说更好」的回复建议由下面的模型来写。",
    jevOnlyNote: "只用 Jev 分析，不提供回复建议（Jev 只会打分，不会写句子）。",
    mask: "发送前自动打码手机号、邮箱、身份证号、银行卡号",
    maskWords: "额外打码的词（真名、学校、地址等，用逗号分隔）",
    maskWordsPlaceholder: "例如：张三，XX中学，幸福小区",
    cache: "缓存分析结果：同样的内容再分析时不重复花钱",
    jevPrices: "Jev 的单价",
    prices: "单价",
    pricesUnit: "（元 / 百万 token，用于估算花费，请以服务商官网为准）",
    priceKinds: { input: "输入", cached: "缓存命中", output: "输出" },
    resetPrices: "恢复默认",
    saveTest: "保存并测试连接",
    saveOnly: "仅保存",
    clearCache: "清除本地缓存",
    locked: "正在分析，停止或完成后才能保存模型设置。",
    suggestModel: (jev: string, chat: string) => `${jev}，回复建议 ${chat}`,
  },
  spend: {
    title: "花费",
    requests: "分析请求",
    requestsValue: (n: number) => `${num(n)} 次`,
    input: "输入 tokens",
    cached: "其中缓存命中",
    output: "输出 tokens",
    estimated: "按单价估算",
    capTitle: "单次分析花费上限",
    capNote:
      "一次分析的花费超过这个数就自动暂停，已完成的部分会保留，调高后可以接着分析。留空表示不限。",
    capLabel: "上限（元）",
    capPlaceholder: "例如 5",
    capSave: (budget: number | null) =>
      budget ? `保存（当前 ¥${budget}）` : "保存上限",
    calibrateTitle: "按实际账单校准",
    calibrateNote:
      "单价在设置的「模型与接口」里可以改，DeepSeek / OpenAI 和 Jev 各有一套单价和校准。服务商分高峰、低谷时段定价，估算难免有偏差；切换过模型时，这段聊天的累计花费按当前模型的单价估算。",
    calibrated: (f: string) => ` 当前已按你的账单校准（×${f}）。`,
    learned: (f: string) =>
      ` 预估还按过去几次分析的实际用量自动修正了（×${f}）。`,
    billLabel: "上面这些分析实际花了多少元？",
    billPlaceholder: "例如 8.3",
    calibrate: "校准",
    uncalibrate: "取消校准",
  },
  disclaimer: {
    title: "使用前请阅读",
    funTitle: "仅供娱乐参考",
    fun: "分析结果由大模型根据聊天文字自动生成，可能出错、片面或前后不一致。它不了解你们在聊天之外的相处，不代表对方的真实想法，也不是心理咨询或情感建议。请不要仅凭分析结果做表白、分手、冷落对方等重要决定。",
    privacyTitle: "隐私与他人信息",
    privacy:
      "聊天记录里有对方的话和个人信息。分析时，所需的聊天片段（按设置自动打码后）会发送给你配置的模型服务商（如 DeepSeek，或调用 Jev 的 OpenRouter 等平台），由其按自己的隐私政策处理。请只分析你有权处理的聊天，尊重对方的隐私，不要把结果或原文公开传播。",
    costTitle: "费用",
    cost: "调用模型会从你自己的 API 账户扣费。页面上的预计花费和已花费都是按单价估算的，服务商分时段定价、缓存命中情况都会让实际费用不同，请以服务商账单为准。可以在设置里给单次分析设花费上限。",
    banTitle: "禁止的用途",
    ban: "不得用于监视、跟踪、骚扰、操控或威胁他人，不得分析未经授权获取的聊天记录。未成年人请在监护人知情的情况下使用。",
    liabilityTitle: "免责",
    liability:
      "本工具按「现状」提供，作者和改编者不对分析结果的准确性，以及因使用本工具产生的任何直接或间接后果承担责任。本项目与微信、腾讯、TypeSafe、DeepSeek、OpenAI、OpenRouter 及 Vercel 无隶属关系。",
    accept: "我已阅读并了解，继续使用",
  },
  search: {
    title: "搜索与筛选",
    filters: {
      all: "全部",
      lowReply: "我的低分回复",
      negative: "对方负面情绪",
      incomplete: "未完成",
      corrected: "我纠正过的",
    },
    label: "搜索聊天内容",
    placeholder: "比如：周末、吃饭、生日",
    filter: "筛选",
    found: (n: number) => `找到 ${num(n)} 条`,
    capped: (n: number) => `，只显示前 ${n} 条`,
    hint: "输入关键词，或选一个筛选条件。",
    rating: (label: string) => ` · 回复评级 ${label}`,
  },
  importer: {
    title: "确认聊天里的你",
    allOther: "这些都是对方的话",
    found: (n: number) => `识别到 ${num(n)} 条聊天`,
    twoPeople: "请保留两个人的聊天，可改成「我：内容」「对方：内容」。",
    unassigned: "有几行没认出是谁说的，可在前面加上「名字：」。",
    import: "导入聊天",
    note: "导入后会先显示预计花费，确认后再点「开始分析」。",
    overlapTitle: "这段可能重复了",
    overlapBody: "相同内容也可能是新消息，请选择如何合并。",
    skip: "跳过重合部分",
    append: "作为新消息追加",
  },
  momentsView: {
    showMinor: "也显示提问、澄清、说出喜好这类日常事件",
    empty:
      "还没有识别到关键时刻。逐句分析完成后，邀约、关心、表达心意等事件会出现在这里。",
    answered: " · 已回应",
  },
  trend: {
    needMore:
      "聊天需要跨越至少两周（或超过约 120 条）才能画出走势，分析完成后会自动生成。",
    aria: "好感度随时间的变化",
    affinity: (v: string) => `好感 ${v}`,
    count: (n: number) => ` · ${num(n)} 条`,
    jump: "跳到这句",
  },
  report: {
    trendAria: "好感度走势",
    eyebrow: "Crush 好感监控器 · 分析报告",
    heading: (name: string) => `和 ${name} 的聊天`,
    messages: (n: number) => `${num(n)} 条消息`,
    range: (from: string, to: string) => `${from} 至 ${to}`,
    affinity: "好感度",
    stage: "关系阶段",
    performance: "我的发挥",
    points: (n: number) => `${n} 分`,
    reading: "整体解读",
    dimensions: "六个维度",
    next: "下一步",
    notDone: "还没有完成分析。",
    trend: "关系走势",
    moments: "关键时刻",
    keyLine: "最能说明问题的一句",
    footer: (time: string) =>
      `由大模型根据聊天文字生成，只是娱乐参考，不代表对方的真实想法。生成于 ${time}。`,
    title: (name: string) => `好感分析报告 · ${name}`,
    file: "好感分析报告",
  },
  errors: {
    analysisFailed: "分析失败",
    revisionMismatch: "分析版本不匹配，请刷新重试",
    contextMismatch: "分析上下文不匹配，请重试",
    nothingToAnalyze: "记录已保存，但没有可分析的文字。单条过长的消息请拆分。",
    saveInterrupted: "保存被中断",
    // Codes sent by the server.
    forbidden: "请求来源不允许",
    badSettings: "设置格式不正确，请检查接口地址等字段",
    envWrite: "写入 .env 失败，请检查文件权限",
    testTimeout: "30 秒内没有连上，请检查网络、Key 和设置后重试",
    http400: "请求被模型拒绝，可能是输入过长或模型名不支持，请查看服务端日志",
    http401: "API 认证失败，请在设置里检查 API Key",
    http402: "API 账户余额不足，请充值后重试",
    http403: "当前 API 账号没有调用权限",
    http404: "找不到模型或接口，请在设置里检查模型名和接口地址",
    http413: "聊天太长，超出模型一次能读的范围，请只分析最近 7 天或 30 天",
    http422: "模型返回格式异常，请重试或缩小聊天范围",
    http429: "模型服务限流，请稍后重试",
    http529: "模型服务暂时繁忙，请重试",
    jev400:
      "Jev 没有接受这次请求，可能是聊天太长，请只分析最近 7 天或 30 天后重试",
    jev401: "Jev 的 API Key 无效，请在设置里检查（要填所选调用平台的 Key）",
    jev402: "调用 Jev 的平台余额不足，请到该平台充值后重试",
    jev403:
      "没有调用 Jev 的权限：用 Vercel 调用需要先在 Vercel 绑定信用卡；其他平台请检查 Key 的权限",
    jev404: "Jev 接口暂时不可用，可以在设置里换一个调用平台试试",
    jev502: "连不上 Jev 的调用平台或请求超时，请检查网络后重试",
    network: "连不上模型服务，请检查网络和接口地址",
    unfinished: "分析未完成，可能是网络超时。已保留聊天，可重试。",
    badChat: "聊天结构或长度不符合要求，请校正后重试",
    noKey: "还没有设置 API Key，请点左下角设置填写",
    busy: "分析请求较多，已保留进度，请稍后继续",
    badRequest: "请求格式不正确",
    noSuggestJevOnly:
      "当前是「仅 Jev」模式，没有回复建议。需要的话在设置里改成「Jev + DeepSeek / OpenAI」并填写 Key",
    noSuggestKey: "写回复建议需要 DeepSeek / OpenAI 的 API Key，请在设置里填写",
    unsupported: "输入格式或体积不受支持",
    jevChatNoReply: "Jev 正常，但回复建议用的模型没有按要求回复",
    jevChatFailed:
      "Jev 正常，但回复建议用的 DeepSeek / OpenAI 连接失败，请检查它的 Key 和接口地址",
    versionMismatch:
      "网页和后台版本不一致：请关掉启动窗口（黑色窗口）重新打开，再刷新网页",
  },
};

/** The shape every language file must match exactly. */
export type Messages = typeof zh;

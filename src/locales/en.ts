// All interface text in English. Typed as Messages, so every key in zh.ts
// must be here and nothing else may be.
import type { Messages } from "./zh";

const num = (n: number) => n.toLocaleString("en-US");
/** "1 message", "2 messages" */
const count = (n: number, one: string, many = `${one}s`) =>
  `${num(n)} ${n === 1 ? one : many}`;

export const en: Messages = {
  lang: "en",
  switchTo: "中",
  switchLabel: "切换到中文",
  appTitle: "Crush Monitor",
  me: "Me",
  other: "Them",
  close: "Close",
  reasoning: "Reasoning",
  pending: "Pending",
  dash: "—",
  colon: ": ",
  quote: (s) => `“${s}”`,
  points: (n) => `${n} pts`,
  yuan: (v, s = "¥") =>
    v < 0.01 ? `under ${s}0.01` : `~${s}${v < 1 ? v.toFixed(2) : v.toFixed(1)}`,
  yuanShort: (v, s = "¥") =>
    v < 0.01 ? `<${s}0.01` : `${s}${v < 1 ? v.toFixed(2) : v.toFixed(1)}`,
  tokens: (n) =>
    n >= 1e6
      ? `${(n / 1e6).toFixed(1)}M`
      : n >= 1000
        ? `${(n / 1000).toFixed(n >= 1e5 ? 0 : 1)}K`
        : String(n),

  emotions: {
    happy: "Happy",
    confused: "Confused",
    angry: "Angry",
    sad: "Sad",
    shy: "Shy",
    caring: "Caring",
    teasing: "Teasing",
    calm: "Calm",
    annoyed: "Impatient",
    surprised: "Surprised",
    disappointed: "Disappointed",
    unknown: "Unclear",
  },
  intents: {
    share: "Sharing update",
    answer: "Answering",
    inform: "Informing",
    ask: "Asking",
    clarify: "Checking understanding",
    explain: "Explaining",
    academic: "Academic talk",
    opinion: "Giving an opinion",
    agree: "Agreeing",
    disagree: "Disagreeing",
    acknowledge: "Acknowledging",
    continue: "Keeping it going",
    change: "Changing the topic",
    joke: "Joking",
    vent: "Venting",
    comfort_seek: "Seeking comfort",
    validation: "Seeking validation",
    help: "Asking for help",
    advice: "Giving advice",
    care: "Showing care",
    comfort: "Comforting",
    praise: "Complimenting",
    thanks: "Thanking",
    apologize: "Apologizing",
    attention: "Seeking attention",
    interest: "Gauging interest",
    invite_hint: "Hinting at plans",
    invite: "Inviting",
    flirt: "Flirting",
    affection: "Showing affection",
    ease: "Easing tension",
    refuse: "Soft refusal",
    boundary: "Setting a boundary",
    close: "Ending chat",
    other: "Other",
    unknown: "Unclear",
  },
  intentHints: {
    share:
      "Talks about their own experiences, activities or state — sharing rather than answering a question",
    answer:
      "Replies to a specific earlier question, mainly to give the asked-for information",
    inform:
      "Passes on facts, plans or progress, as opposed to sharing personal feelings or experiences",
    ask: "Asks for facts, reasons, plans or a situation; no romantic motive should be assumed",
    clarify:
      "Checks their own understanding of what was said, asking whether something was meant",
    explain:
      "Clears up a reason or misunderstanding, or adds background, so their words or actions make sense",
    academic:
      "Discusses study, research, professional or technical topics (problems, papers, courses, code, tools) — the focus is the knowledge itself; a serious topic is not coldness, nor automatically flirting",
    opinion: "States a view or judgment without clearly asking for agreement",
    agree:
      "Agrees with the other person's view, feeling or suggestion — more than just acknowledging",
    disagree:
      "Offers a different view, pushes back or corrects — not the same as rejecting the relationship",
    acknowledge:
      "A short sign of having seen or understood, like “ok” or “mm”, with no clearer purpose",
    continue:
      "Picks up the thread or adds to it, mainly to keep the conversation going",
    change:
      "Steers the conversation elsewhere; a topic change alone does not mean avoidance or rejection",
    joke: "Jokes, plays along or teases kindly, mainly for fun, without clear romantic testing",
    vent: "Expresses trouble or complaints to let off steam, without clearly asking for solutions",
    comfort_seek:
      "Shows vulnerability or hurt, hoping for emotional support — more than just sharing what happened",
    validation:
      "Wants their feelings, views or worth affirmed, as opposed to simply stating an opinion",
    help: "Wants concrete advice, information or practical help",
    advice: "Offers a solution or course of action, not just an opinion",
    care: "Pays attention to the other person's state or needs; care alone does not signal romance",
    comfort:
      "Takes in the other person's trouble and encourages or supports them, as opposed to seeking comfort",
    praise:
      "Affirms the other person's qualities or actions; not automatically flirting",
    thanks: "Thanks the other person for their reply, help or effort",
    apologize: "Admits something was off, apologizes or tries to repair things",
    attention:
      "Wants more attention, replies or company; needs evidence in context — ordinary sharing does not count",
    interest:
      "Indirectly checks whether the other person cares or is romantically interested; needs specific context",
    invite_hint:
      "Subtly creates a chance to do something or meet, without a direct invitation yet; just saying “bored” is not enough",
    invite:
      "Directly invites the other person to meet, do something together or settle a plan",
    flirt:
      "Tests the waters with double meanings, affectionate or romantic joking; ordinary teasing is not flirting, and it is not consent to anything more",
    affection:
      "Expresses missing, cherishing or valuing the relationship; needs visible evidence in the text",
    ease: "Eases awkwardness, conflict or tension; a joke here is mainly to smooth things over",
    refuse:
      "Politely declines a current suggestion or invitation; not to be stretched into rejecting romance or the person",
    boundary:
      "States something they won't do or accept, or asks for something to stop; a clear no is not playing hard to get",
    close:
      "Signals, openly or implicitly, that this conversation is ending, or that they are busy or going to rest",
    other: "The purpose is visible but fits none of the categories above",
    unknown:
      "Needed context is missing or the ambiguity can't be resolved, so the main purpose can't be judged",
  },
  dimensions: {
    initiative: "Proactive continuation",
    engagement: "Response engagement",
    care: "Care & warmth",
    openness: "Self-disclosure",
    intimacy: "Intimacy expression",
    action: "Actions taken",
  },
  ratings: {
    SSS: "Outstanding — natural, and lands the context precisely",
    SS: "Excellent — balances feelings, tact and keeping the topic going",
    S: "Very good — responds well and makes the conversation flow",
    A: "Good — natural and mindful of the context",
    B: "Okay — fits, but could be expressed better",
    C: "Weak — may feel stiff or miss the other person's feelings",
    D: "Poor — may add pressure, offend, or make it hard to continue",
  },
  judgment: {
    insufficient: "Not enough to go on",
    clear: "Fairly clear",
    ambiguous: "Ambiguous",
  },
  relations: {
    new: "Just met",
    friend: "Friends",
    secret: "I have a crush on them",
    crush: "Talking stage",
    pursuing: "I'm pursuing them",
    pursued: "They're pursuing me",
    couple: "In a relationship",
    cold: "Fighting / silent treatment",
    ex: "Exes",
    reconcile: "Hoping to get back together",
  },
  relationGroups: {
    认识阶段: "Getting to know",
    心动: "Romantic interest",
    恋爱: "Together",
    分开后: "After a breakup",
  },
  relationHints: {
    new: "You only just met and are still getting to know each other; politeness, formality and testing the waters are normal — don't over-read them",
    friend:
      "You're friends for now; friendliness, care and jokes don't automatically mean flirting",
    secret:
      "You like them, but they may not know and their feelings are unknown; focus on their responses and effort, and don't mistake politeness for interest",
    crush:
      "You're in the talking stage: there's mutual interest and you could become a couple, but nothing is official yet",
    pursuing:
      "You're openly pursuing them; focus on whether they accept, respond or avoid, and whether your pursuit feels comfortable to them or adds pressure",
    pursued:
      "They're openly pursuing you; their initiative is expected, so focus on how much care they put in, and whether your replies are clear and comfortable for you",
    couple:
      "You're dating; focus on rapport, looking after each other's feelings, and everyday closeness",
    cold: "You're in a cold war or a fight; short, cool replies are likely about the mood, not a lack of interest. Watch who is easing things and whether there are signs of repair",
    ex: "You've broken up; friendliness and politeness don't mean wanting to get back together — respect the boundaries, and don't read nostalgia as a rekindling",
    reconcile:
      "You used to be together and may get back together; watch whether old problems are faced and whether both of you are moving closer",
  },
  stages: {
    unknown: "Not enough to go on",
    contact: "Just connected",
    flow: "Talking easily",
    flirt: "Some flirting",
    date: "A date is planned",
    mutual: "Both said how they feel",
  },
  actions: {
    continue: {
      label: "Go with the flow",
      detail: "Pick up the current topic — no need to switch.",
    },
    ask: {
      label: "Ask a light question",
      detail: "Ask something small and easy to answer to pass the ball back.",
    },
    empathize: {
      label: "Respond to feelings first",
      detail: "Acknowledge how they feel before reasoning or giving advice.",
    },
    flirt: {
      label: "Flirt a little",
      detail:
        "Build on the joke they already played along with, with just a touch of flirting.",
    },
    invite: {
      label: "Try asking them out",
      detail: "Turn a shared interest into a small, no-pressure plan.",
    },
    clarify: {
      label: "Just ask",
      detail:
        "That line could mean more than one thing; a gentle check beats guessing.",
    },
    wait: {
      label: "Wait for their reply",
      detail:
        "The ball is in their court. Give it some space; no need to follow up yet.",
    },
    close: {
      label: "Wrap up for today",
      detail:
        "End on a comfortable note so there's more to talk about next time.",
    },
    respect: {
      label: "Respect the boundary",
      detail: "They said no or asked for space. Respect that and stop pushing.",
    },
    insufficient: {
      label: "Needs more context",
      detail:
        "These few lines aren't enough — add the surrounding chat and look again.",
    },
  },
  levels: {
    quick: {
      label: "Quick",
      detail:
        "Only the overall score, dimensions, trend and next step — no line-by-line analysis; the cheapest",
    },
    standard: {
      label: "Standard",
      detail: "Quick, plus emotions and intents for each of their messages",
    },
    full: {
      label: "Full",
      detail: "Standard, plus a rating and review for each of your replies",
    },
  },
  moments: {
    boundary: "Refusal / boundary",
    reopen: "Warming up again",
    invitation: "Invite",
    confirmation: "Confirmed",
    cancellation: "Cancelled",
    care: "Care",
    preference: "Preference",
    disclosure: "Opening up",
    commitment: "Confessing feelings",
    question: "Question",
    correction: "Clarification",
    none: "",
  },
  week: (date) => `Week of ${date}`,
  weekShort: (date) => date,
  part: (k) => `Part ${k}`,

  app: {
    noSuggestJevOnly:
      "You're in “Jev only” mode, which has no reply suggestions; switch to “Jev + DeepSeek / OpenAI” in settings.",
    noSuggestKey:
      "Reply suggestions need a DeepSeek / OpenAI API key — add one in settings.",
    avatarSaveFailed: "Couldn't save the avatar; storage may be full.",
    storageReadFailed:
      "Couldn't read local records — check the browser's storage permission. Auto-save is paused so old records aren't overwritten.",
    storageSaveFailed:
      "Couldn't save locally; storage may be full. The page still works, but don't refresh or unsaved records will be lost.",
    nothingNew: "No new messages — this part was already imported.",
    pasteTooLong:
      "This paste is over 250,000 characters; add it in several parts. Your history won't be cut.",
    clearFailed: "Couldn't delete local records — try clearing again.",
    suggestFailed: "Couldn't generate suggestions",
    wechat: "Chat",
    rail: "Chat tools",
    scrollLatest: "Scroll to the latest message",
    chatSettings: "Chat settings",
    emptyTitle: "Paste a chat",
    emptyBody: "Works with WeChat and QQ copies and WhatsApp text exports",
    tryExample: "Try a sample chat",
    myPerformance: "My replies",
    nextStep: "Next step",
    waitingImport: "Waiting for a chat",
    trendTitle: "Relationship trend",
    trendNote:
      "Each point scores the affection signals in that period, reading only that period and a little before it. Changes over 10 points are marked; click a dot or quote to jump to that spot in the chat.",
    momentsTitle: "Key Moments",
    clearTitle: "Start a new chat?",
    clearBody:
      "The current chat, its analysis and the locally saved records will be deleted.",
    clearConfirm: "Start a new chat",
    clearKeep: "Keep this chat",
  },
  header: {
    viewAffinity: "View Affection Score details",
    affinity: "Affection Score",
    search: "Search & filter",
    trend: "Relationship trend",
    moments: "Key Moments",
    report: "Export report",
    newChat: "New chat",
    more: "More chat settings",
  },
  composer: {
    label: "Paste a chat",
    placeholderEmpty: "Paste a chat here…",
    placeholderMore: "Paste more of the chat; duplicates merge automatically",
    fileTitle:
      "Choose an exported .txt chat; you can import the same person's chat several times and overlaps merge automatically",
    importFile: "Import file",
    importChat: "Import chat",
  },
  status: {
    limit: (messages, chars) =>
      `${num(messages)} messages / ${num(chars)} characters`,
    ranges: { all: "All", week: "Last 7 days", month: "Last 30 days" },
    lessThanMinute: "under a minute",
    minutes: (n) => `about ${n} min`,
    level: "Analysis level",
    range: "Analysis range",
    rangeTitle:
      "Line-by-line analysis covers only this period; the overall score always reads the whole chat",
    analyzing: (done, total) => `Analyzing ${done}/${total}`,
    remaining: (eta) => ` · ${eta} left`,
    spentSoFar: (cost) => ` · spent ${cost}`,
    ofEstimate: (cost) => ` / est. ${cost}`,
    stop: "Stop",
    batchRunning: (limit) =>
      `The chat is over the per-request limit (${limit}); sending in batches`,
    batchRange: (from, to, count) =>
      `: analyzing messages ${num(from)}–${num(to)} of ${num(count)}`,
    capped: (budget, s = "¥") =>
      `Reached the per-run limit of ${s}${budget}; paused.`,
    incomplete: "Analysis incomplete. ",
    stale: "Showing results from older rules. ",
    langChanged:
      "The current analysis is in Chinese; re-running writes it in English. ",
    pendingLines: (n) => `${count(n, "message")} to analyze`,
    overviewOnly: "Overview only",
    batchHintTitle: (limit) =>
      `Reads up to ${limit} at a time: line-by-line analysis and the trend cover every message in batches; the overall score reads the most recent part.`,
    batchHintBig: " (over the limit; will send in batches)",
    batchHintSmall: " (over the limit; the overview reads the recent part)",
    estimate: (cost) => ` · Est. ${cost}`,
    jevBill: " (Jev: see your platform's bill)",
    startTitle: (requests, input, output) =>
      `About ${count(requests, "request")}, ~${input} input and ~${output} output tokens. Estimated from the prices in settings and corrected by recent runs; your provider's bill is what counts.`,
    resume: "Continue",
    start: "Start Analysis",
    done: "Done",
    forFun: "For fun only",
    retrying: (n) => `Retrying ${n}…`,
    retryOnly: (n, cost) =>
      n === 1
        ? `Retry just the unfinished message (${cost})`
        : `Retry only these ${num(n)} unfinished messages (${cost})`,
    spendTitle:
      "See the cost breakdown, set a per-run limit, or calibrate to your bill",
    spent: (cost) => `Spent ${cost}`,
    noKey: "No API key yet — click to add one",
  },
  line: {
    emotionTitle: "Emotion & intent",
    replyTitle: "Reply review",
    emotion: "Emotion",
    intent: "Intent",
    intentPending: "Intent not analyzed yet.",
    distributionNote:
      "Each row shows candidate readings of the main emotion and the main purpose — not a measurement of what they truly feel. Up to three per row, with the raw probabilities (not rescaled to 100%).",
    replyRating: (label) => `Reply Rating: ${label}`,
    noContext: "Not enough context to judge this reply",
    replyScore: (value) => `Reply score ${value} / 100`,
    rephrase: "Rephrase",
    thinking: "Thinking…",
    tryAgain: "Try again",
    howBetter: "How could I say this better?",
    yourNote: "Your note",
    editNote: "Edit the note and judge again",
    wrong: "Wrong? Tell the model what's really going on",
    noteLabel:
      "What does this really mean? (Background only you know, like “it's our inside joke” or “she's joking”)",
    reconsidering: "Re-judging…",
    reconsider: "Re-judge with my note",
    reconsiderNote:
      "Re-analyzes only this line with one model call, usually under a cent. Your note is kept and used in future analyses too.",
    disclaimer:
      "Judged from the chat imported so far; not what they truly think.",
  },
  row: {
    pendingTip:
      "Click “Start Analysis” at the bottom; you'll see the estimated cost first",
    analyzing: "Analyzing",
    pending: "Pending",
    recalled: (self) =>
      self ? "You recalled a message" : "They recalled a message",
    nudged: (who, whom) => `${who} nudged ${whom}`,
    systemTip:
      "A system notice — not analyzed on its own, only used as context",
    unreadableTip:
      "Content not visible — not analyzed on its own, only used as context",
    retryTip:
      "The model didn't return a full result this time; you can retry just this one",
    retry: "Unfinished — retry this",
    emotion: "Emotion",
    intent: "Intent",
    emotionAria: (label, pct, text) =>
      `${label} ${pct}, view emotion analysis: ${text}`,
    intentAria: (label, pct, text) =>
      `${label} ${pct}, view intent analysis: ${text}`,
    replyAria: (text) => `View reply review: ${text}`,
    replyRating: "Reply Rating: ",
    noteTip: (note) => `Your note: ${note}`,
    corrected: "Re-judged with your note",
    skippedTooLong: "Over 12,000 characters — saved, but split it to analyze",
  },
  overview: {
    titles: {
      overview: "Affection Score",
      action: "Next step",
      performance: "My replies",
    },
    staleNote:
      "These results come from older analysis rules and are for viewing only. Click “Start Analysis” at the bottom to re-analyze with the current rules.",
    reading: "Overall analysis",
    scoreNote:
      "0–100 is the model's score for the affection signals in this chat — not “the probability they like you”.",
    basisNote:
      "Scored from recent messages and related earlier quotes; old scores aren't reused. With little evidence the score is still shown, for fun.",
    history: "Earlier quotes used",
    dimAria: (label, value) => `${label} ${value} points`,
    weight: (w, status) => `${w}% weight · ${status}`,
    boundaryCap: (raw) =>
      `They set a clear boundary that still applies. From a combined ${raw}, the score shown is capped at 25.`,
    verdict: (status, pct) =>
      `This round: ${status}. Overall confidence ${pct}.`,
    waiting: "Waiting for a chat",
    waitingDetail: "Suggestions appear after you import a chat.",
    performanceNote:
      "The average score of your analyzed replies. The model judges each reply against what came before it, then shows a grade by fixed score bands. The Quick and Standard levels don't score your replies.",
    ratingRange: (label, range) => `${label} · ${range}`,
  },
  settings: {
    title: "Chat Settings",
    relation: "Your relationship",
    note: "Background (optional; helps the model read the tone)",
    notePlaceholder:
      "e.g. High-school classmates, known each other three years; she always texts briefly and rarely uses emoji; busy preparing for exams lately",
    saveNote: "Save background",
    swap: "Swap the two sides",
    clear: "Clear chat and start over",
    disclaimer: "Disclaimer & risks",
    saved: (n) =>
      `${count(n, "message")} saved. Records stay in this browser and survive a refresh; analysis sends only the parts it needs to the model. After changing the relationship or background, the estimated cost shows again before you analyze.`,
    avatars: "Avatars",
    avatarNote:
      "Pictures are cropped square, compressed and kept in this browser; never sent to the model, and kept when you clear the chat.",
    model: "Model & API",
    language: "Language",
    version: (v) => `Version ${v} · Universal edition`,
  },
  avatar: {
    change: (who) => `Change ${who}'s avatar`,
    clickToChange: "Click to change the avatar",
    replace: "Change",
    upload: "Upload",
    reset: "Reset",
    unreadable: "Couldn't read that image — try another one",
  },
  model: {
    typesafe: "TypeSafe (official)",
    loadFailed:
      "Couldn't load settings — make sure the launcher window is still open",
    loading: "Loading settings…",
    openrouterKey:
      "This looks like an OpenRouter key — choose OpenRouter as the platform",
    savingTest: "Saving and testing the connection…",
    saving: "Saving…",
    saveFailed: "Couldn't save",
    saved: "Saved; in effect now",
    connected: (model, seconds) => `Connected: ${model}, ${seconds}s`,
    failed: (reason) => `Connection failed: ${reason}`,
    noReply: "The model didn't reply as expected",
    cacheCleared: "Cleared the locally cached results",
    suggestKey: "API key for reply suggestions (DeepSeek / OpenAI)",
    apiKey: "API key",
    keySet: (hint) => `Set (${hint}); leave blank to keep it`,
    pasteKey: "Paste your API key",
    baseURL: "API base URL",
    modelName: "Model",
    effort: "Reasoning effort",
    effortNone: "Not set (choose this for DeepSeek)",
    temperature: "Temperature (blank = default; lower is more consistent)",
    analysisModel: "Model used for analysis",
    jevOriginal: "Jev (original model)",
    switchNote:
      "Switches after you save. Messages already analyzed keep their results; new messages and the overview use the new model.",
    jevPlatform: "Jev platform",
    jevNoteApply: "Get a key at",
    jevNoteRest:
      ". Jev is the TypeSafe judgment model the original author used; its probabilities are specially calibrated, but it writes no reasoning. It reads up to 500 messages / 12,000 characters at a time; longer chats are sent in batches automatically (every message gets line-by-line analysis; the overall score reads the most recent part). Jev is billed by the platform, so the price estimates below are approximate.",
    platformKey: (platform) => `${platform} API key`,
    suggestions: "Reply suggestions",
    jevOnly: "Jev only",
    jevPlus: "Jev + DeepSeek / OpenAI",
    jevPlusNote:
      "Jev analyzes; the model below writes the “How could I say this better?” suggestions.",
    jevOnlyNote:
      "Analyze with Jev only, no reply suggestions (Jev scores, it doesn't write).",
    mask: "Mask phone numbers, emails, ID and bank card numbers before sending",
    maskWords:
      "Extra words to mask (real names, schools, addresses — comma-separated)",
    maskWordsPlaceholder: "e.g. Alex Chen, Riverside High, Oak Street",
    cache: "Cache results: re-analyzing the same content costs nothing",
    jevPrices: "Jev prices",
    prices: "Prices",
    pricesUnit: (s) =>
      ` (${s} per million tokens, for estimates; check your provider's site)`,
    currency: "Currency",
    currencies: { CNY: "¥ CNY", USD: "$ USD" },
    currencyNote:
      "Switching converts the prices and limit you've entered at 1 USD = 7.2 CNY.",
    priceKinds: { input: "Input", cached: "Cache hit", output: "Output" },
    resetPrices: "Reset",
    saveTest: "Save & test connection",
    saveOnly: "Save only",
    clearCache: "Clear local cache",
    locked:
      "Analysis running — model settings can be saved once it stops or finishes.",
    suggestModel: (jev, chat) => `${jev}, suggestions ${chat}`,
  },
  spend: {
    title: "Cost",
    requests: "Requests",
    requestsValue: (n) => num(n),
    input: "Input tokens",
    cached: "of which cache hits",
    output: "Output tokens",
    estimated: "Estimated cost",
    capTitle: "Per-run cost limit",
    capNote:
      "A run pauses automatically once it costs more than this; finished work is kept, and you can continue after raising it. Leave blank for no limit.",
    capLabel: (s) => `Limit (${s})`,
    capPlaceholder: "e.g. 5",
    capSave: (budget, s = "¥") =>
      budget ? `Save (currently ${s}${budget})` : "Save limit",
    calibrateTitle: "Calibrate to your bill",
    calibrateNote:
      "Prices can be changed under “Model & API” in settings; DeepSeek / OpenAI and Jev each keep their own prices and calibration. Providers charge differently at peak and off-peak times, so estimates are never exact; if you switched models, this chat's total is priced at the current model's rates.",
    calibrated: (f) => ` Calibrated to your bill (×${f}).`,
    learned: (f) => ` Estimates are also corrected from recent runs (×${f}).`,
    billLabel: (s) => `What did the runs above actually cost, in ${s}?`,
    billPlaceholder: "e.g. 8.3",
    calibrate: "Calibrate",
    uncalibrate: "Remove calibration",
  },
  disclaimer: {
    title: "Please read before using",
    funTitle: "For fun only",
    fun: "Results are generated by a large language model from the chat text and may be wrong, one-sided or inconsistent. It knows nothing about your life outside the chat, doesn't represent what the other person truly thinks, and isn't counselling or relationship advice. Don't make important decisions — confessing, breaking up, going cold — based on it alone.",
    privacyTitle: "Privacy and other people's information",
    privacy:
      "A chat contains the other person's words and personal details. During analysis, the parts needed (masked according to your settings) are sent to the model provider you configured (such as DeepSeek, or a platform like OpenRouter for Jev) and handled under their privacy policy. Only analyze chats you have the right to process, respect the other person's privacy, and don't publish the results or the original text.",
    costTitle: "Cost",
    cost: "Model calls are billed to your own API account. Estimated and spent amounts on the page are based on unit prices; time-of-day pricing and cache hits make the real cost differ, so your provider's bill is what counts. You can set a per-run cost limit in settings.",
    banTitle: "Prohibited uses",
    ban: "Don't use this to monitor, track, harass, manipulate or threaten anyone, or to analyze chats obtained without permission. Minors should use it with a guardian's knowledge.",
    liabilityTitle: "Disclaimer",
    liability:
      "Provided “as is”. The author and adapter accept no responsibility for the accuracy of results or for any direct or indirect consequences of using this tool. Not affiliated with WeChat, Tencent, TypeSafe, DeepSeek, OpenAI, OpenRouter or Vercel.",
    accept: "I've read this — continue",
  },
  search: {
    title: "Search & Filter",
    filters: {
      all: "All",
      lowReply: "My low-rated replies",
      negative: "Their negative emotions",
      incomplete: "Unfinished",
      corrected: "Corrected by me",
    },
    label: "Search the chat",
    placeholder: "e.g. weekend, dinner, birthday",
    filter: "Filter",
    found: (n) => `${num(n)} found`,
    capped: (n) => `, showing the first ${n}`,
    hint: "Type a keyword or pick a filter.",
    rating: (label) => ` · Reply Rating ${label}`,
  },
  importer: {
    title: "Which one is you?",
    allOther: "All of these are the other person",
    found: (n) => `${count(n, "message")} found`,
    twoPeople:
      "Keep a two-person chat; you can rewrite lines as “Me: …” and “Them: …”.",
    unassigned: "Some lines have no speaker; start them with “Name: ”.",
    import: "Import chat",
    note: "After importing you'll see the estimated cost first; then click “Start Analysis”.",
    overlapTitle: "This part may be a duplicate",
    overlapBody:
      "Identical text could still be new messages — choose how to merge.",
    skip: "Skip the overlap",
    append: "Add as new messages",
  },
  momentsView: {
    showMinor: "Also show daily events",
    empty:
      "No key moments found yet. After line-by-line analysis, invitations, care, confessions and similar events appear here.",
    answered: " · answered",
  },
  trend: {
    needMore:
      "The chat needs to span at least two weeks (or roughly 120+ messages) to draw a trend; it appears after analysis.",
    aria: "Affection score over time",
    affinity: (v) => `Affection ${v}`,
    count: (n) => ` · ${count(n, "message")}`,
    jump: "Jump to message",
  },
  report: {
    trendAria: "Affection score trend",
    eyebrow: "Crush Monitor · Analysis report",
    heading: (name) => `Chat with ${name}`,
    messages: (n) => count(n, "message"),
    range: (from, to) => `${from} to ${to}`,
    affinity: "Affection Score",
    stage: "Stage",
    performance: "My replies",
    points: (n) => `${n} pts`,
    reading: "Overall analysis",
    dimensions: "Six dimensions",
    next: "Next step",
    notDone: "Analysis not finished yet.",
    trend: "Relationship trend",
    moments: "Key Moments",
    keyLine: "The most telling line",
    footer: (time) =>
      `Generated by a large language model from the chat text — for fun only, not what the other person truly thinks. Created ${time}.`,
    title: (name) => `Chat analysis report · ${name}`,
    file: "chat-analysis-report",
  },
  demo: {
    banner: "Online demo · a sample chat, analyzed in advance",
    forFun: "Just for fun, not mind reading",
    getApp: "Get the app →",
  },
  errors: {
    demo: "This is the online demo: it shows a sample chat that was analyzed in advance. To analyze your own chats, download the app and run it on your computer (free and open source).",
    analysisFailed: "Analysis failed",
    revisionMismatch: "Analysis version mismatch — refresh and try again",
    contextMismatch: "Analysis context mismatch — try again",
    nothingToAnalyze:
      "Saved, but there's no text to analyze. Split any very long single message.",
    saveInterrupted: "Saving was interrupted",
    forbidden: "Request origin not allowed",
    badSettings: "Invalid settings — check the API base URL and other fields",
    envWrite: "Couldn't write .env — check file permissions",
    testTimeout:
      "Couldn't connect within 30 seconds — check your network, key and settings",
    http400:
      "The model rejected the request — the input may be too long or the model name unsupported; see the server log",
    http401: "API authentication failed — check the API key in settings",
    http402: "Your API account is out of credit — top up and try again",
    http403: "This API account isn't allowed to call the model",
    http404:
      "Model or endpoint not found — check the model name and base URL in settings",
    http413:
      "The chat is too long for one request — analyze only the last 7 or 30 days",
    http422:
      "The model returned a malformed reply — try again or narrow the chat",
    http429: "The model service is rate-limiting — try again shortly",
    http529: "The model service is busy — try again",
    jev400:
      "Jev didn't accept the request; the chat may be too long — analyze only the last 7 or 30 days and retry",
    jev401:
      "The Jev API key is invalid — check it in settings (use the key for the chosen platform)",
    jev402:
      "The platform used for Jev is out of credit — top up there and retry",
    jev403:
      "No permission to call Jev: Vercel needs a credit card on file first; on other platforms, check the key's permissions",
    jev404:
      "The Jev endpoint is unavailable — try another platform in settings",
    jev502:
      "Couldn't reach the Jev platform or it timed out — check your network and retry",
    network:
      "Couldn't reach the model service — check your network and base URL",
    unfinished:
      "Analysis didn't finish, possibly a network timeout. The chat is kept; you can retry.",
    badChat:
      "The chat's structure or length isn't supported — fix it and retry",
    noKey: "No API key yet — add one in settings (bottom left)",
    busy: "Too many analysis requests; progress is kept — continue in a moment",
    badRequest: "Invalid request",
    noSuggestJevOnly:
      "You're in “Jev only” mode, which has no reply suggestions. To get them, switch to “Jev + DeepSeek / OpenAI” in settings and add a key",
    noSuggestKey:
      "Reply suggestions need a DeepSeek / OpenAI API key — add one in settings",
    unsupported: "Unsupported input format or size",
    jevChatNoReply:
      "Jev works, but the reply-suggestion model didn't reply as expected",
    jevChatFailed:
      "Jev works, but the DeepSeek / OpenAI connection for reply suggestions failed — check its key and base URL",
    versionMismatch:
      "The page and the server are different versions: close the launcher window (the black one), open it again, then refresh the page",
  },
};

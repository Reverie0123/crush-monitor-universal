export const examples = [
  {
    name: "先冷后暖",
    tag: "原来还有下一句",
    relation: "crush" as const,
    lines: [
      ["self", "周六要不要一起吃饭？"],
      ["other", "这周有点忙"],
      ["self", "那你先忙，等有空再说～"],
      ["other", "但周日晚上可以呀"],
      ["other", "你不是一直想去那家小酒馆吗？"],
      ["self", "你居然还记得，那周日我订位置"],
      ["other", "当然记得。和你说的话我都有认真听 :)"],
    ],
  },
  {
    name: "礼貌婉拒",
    tag: "体面收尾，也很妙",
    relation: "crush" as const,
    lines: [
      ["self", "周末要不要出去走走？"],
      ["other", "谢谢你，不过我只想和你做普通朋友。"],
      ["self", "明白，谢谢你直接告诉我。"],
      ["other", "也谢谢你的理解。"],
    ],
  },
  {
    name: "情侣拌嘴",
    tag: "先接情绪，再接话",
    relation: "couple" as const,
    lines: [
      ["other", "你今天都没怎么理我"],
      ["self", "工作有点多，刚刚忙完。"],
      ["other", "我知道你忙，但我也想被惦记一下。"],
      ["self", "是我没顾上，下次忙之前先和你说一声。今天累不累？"],
      ["other", "其实有点。你现在能陪我聊一会吗？"],
    ],
  },
];
export function exampleText(index: number) {
  return examples[index].lines
    .map(([s, t]) => `${s === "self" ? "我" : "Crush"}：${t}`)
    .join("\n");
}

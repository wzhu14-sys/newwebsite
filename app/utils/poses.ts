export interface PosePrompt {
  id: string;
  emoji: string;
  title: string;
  titleEn: string;
  tip: string;
}

export const POSE_PRESETS: PosePrompt[] = [
  {
    id: "cheek-heart",
    emoji: "🫶",
    title: "脸颊比心",
    titleEn: "Cheek Heart",
    tip: "把手放在脸颊边比半个爱心",
  },
  {
    id: "kitty-paws",
    emoji: "🐾",
    title: "猫咪爪爪",
    titleEn: "Kitty Paws",
    tip: "双手握拳像小猫一样放在脸颊两旁",
  },
  {
    id: "flower-face",
    emoji: "🌸",
    title: "开花托腮",
    titleEn: "Flower Face",
    tip: "双手掌心托住下巴，甜甜微笑",
  },
  {
    id: "wink-peace",
    emoji: "✌️",
    title: "单眼眨眼比耶",
    titleEn: "Wink & Peace",
    tip: "单眼俏皮眨眼，剪刀手放在眼角",
  },
  {
    id: "peeking",
    emoji: "🙈",
    title: "犹抱琵琶半遮面",
    titleEn: "Playful Peek",
    tip: "用单手轻轻半遮住脸，眼神看镜头",
  },
  {
    id: "cool-chic",
    emoji: "🕶️",
    title: "高冷酷飒",
    titleEn: "Chic & Cool",
    tip: "微微抬起下巴，眼神不屑又高级",
  },
  {
    id: "funky-face",
    emoji: "🤪",
    title: "鬼脸搞怪",
    titleEn: "Funky Face",
    tip: "吐舌头、鼓起腮帮子，尽情搞怪",
  },
  {
    id: "head-pat",
    emoji: "✨",
    title: "扶额头戴皇冠",
    titleEn: "Crown Head",
    tip: "单手自然搭在头顶或额前",
  },
];

/**
 * Generate 4 random distinct poses for the 4-shot sequence
 */
export function getRandom4Poses(): PosePrompt[] {
  const shuffled = [...POSE_PRESETS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 4);
}

export interface ActionChoice {
  text: string;
  risky: boolean;
  approach: string; // "力技" | "技巧" | "知恵" | "話術" | "直感"
}

export type RollOutcome = 'success' | 'partial' | 'failure';

export interface RollResult {
  dice: [number, number];
  modifier: number;
  total: number;
  outcome: RollOutcome;
}

export function rollCheck(modifier: number): RollResult {
  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  const total = d1 + d2 + modifier;
  
  let outcome: RollOutcome = 'failure';
  if (total >= 10) {
    outcome = 'success';
  } else if (total >= 7) {
    outcome = 'partial';
  }
  
  return {
    dice: [d1, d2],
    modifier,
    total,
    outcome
  };
}

const APPROACH_KEYWORDS: Record<string, string[]> = {
  '力技': ['剣', '斧', '怪力', '戦士', '腕力', '破壊', '闘気', '武術', '槍', '打撃', '力'],
  '技巧': ['弓', '短剣', '鍵開け', '器用', '盗賊', '罠', '狙撃', '隠密', '銃', '手先', '技'],
  '知恵': ['魔法', '魔術', '杖', '知識', '魔法使い', '学者', '賢者', '本', '呪文', '魔力', '知'],
  '話術': ['交渉', '魅力', '商人', '説得', 'カリスマ', '威圧', '詐欺', '貴族', '歌', '楽器', '話'],
  '直感': ['感知', '回避', '野生', '狩人', '運', '第六感', '神官', '祈り', '察知', '素早さ', '感']
};

export function calcModifier(choice: ActionChoice, deckCards: any[]): { value: number; reason: string } {
  let value = 0;
  const reasons: string[] = [];
  const keywords = APPROACH_KEYWORDS[choice.approach] || [];
  const usedCardNames = new Set<string>();
  
  for (const card of deckCards) {
    if (!card) continue;
    const cardName = card.name || '不明';
    if (usedCardNames.has(cardName)) continue;

    const textToSearch = `${card.special || ''} ${card.caption || ''} ${cardName} ${card.description || ''} ${card.skill || ''}`.toLowerCase();
    
    // アプローチに関連するキーワードがあるか
    let matched = false;
    for (const kw of keywords) {
      if (textToSearch.includes(kw.toLowerCase())) {
        matched = true;
        break;
      }
    }

    // 選択肢のテキストにカード名が含まれているか
    if (!matched && choice.text.includes(cardName)) {
      matched = true;
    }

    if (matched && value < 2) {
      value += 1;
      reasons.push(`〈${cardName}〉`);
      usedCardNames.add(cardName);
    }
  }
  
  const reason = value > 0 ? `+${value}: ${reasons.join(', ')}の適性` : '';
  
  return { value, reason };
}

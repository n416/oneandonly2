export interface DeckData {
  [slot: number]: string[];
}

const DECKS_STORAGE_KEY = 'oneandonly_decks';
const ACTIVE_SLOT_KEY = 'oneandonly_active_deck_slot';

export function getAllDecks(): DeckData {
  const data = localStorage.getItem(DECKS_STORAGE_KEY);
  if (data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error('Failed to parse decks from localStorage', e);
    }
  }
  return { 1: [], 2: [], 3: [], 4: [] };
}

export function saveAllDecks(decks: DeckData): void {
  localStorage.setItem(DECKS_STORAGE_KEY, JSON.stringify(decks));
}

export function getDeck(slot: number): string[] {
  const decks = getAllDecks();
  return decks[slot] || [];
}

export function setDeck(slot: number, cardIds: string[]): void {
  const decks = getAllDecks();
  decks[slot] = cardIds;
  saveAllDecks(decks);
}

export function getActiveDeckSlot(): number {
  const slotStr = localStorage.getItem(ACTIVE_SLOT_KEY);
  if (slotStr) {
    const slot = parseInt(slotStr, 10);
    if (!isNaN(slot) && slot >= 1 && slot <= 4) {
      return slot;
    }
  }
  return 1;
}

export function setActiveDeckSlot(slot: number): void {
  localStorage.setItem(ACTIVE_SLOT_KEY, slot.toString());
}

export function toggleCardInDeck(slot: number, cardId: string): string[] {
  const decks = getAllDecks();
  const deck = decks[slot] || [];
  
  const index = deck.indexOf(cardId);
  if (index >= 0) {
    // 既に存在する場合は外す
    deck.splice(index, 1);
  } else {
    // 存在しない場合は追加する
    deck.push(cardId);
  }
  
  decks[slot] = deck;
  saveAllDecks(decks);
  return deck;
}

export function exportDecks(): string {
  const decks = getAllDecks();
  return JSON.stringify(decks, null, 2);
}

export function importDecks(jsonStr: string, validCardIds: string[]): boolean {
  try {
    const importedData = JSON.parse(jsonStr);
    
    // basic validation
    if (typeof importedData !== 'object' || importedData === null) {
      return false;
    }

    const newDecks: DeckData = { 1: [], 2: [], 3: [], 4: [] };
    const validIdSet = new Set(validCardIds);

    for (let i = 1; i <= 4; i++) {
      const arr = importedData[i];
      if (Array.isArray(arr)) {
        // 所持しているカードIDのみをフィルタリングして追加
        newDecks[i] = arr.filter((id: any) => typeof id === 'string' && validIdSet.has(id));
      }
    }

    saveAllDecks(newDecks);
    return true;
  } catch (e) {
    console.error('Failed to import decks', e);
    return false;
  }
}

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import JSZip from 'jszip';

interface TRPGDB extends DBSchema {
  characterData: {
    key: string;
    value: { id: string; data: any[] };
  };
  scenarios: {
    key: number;
    value: any;
    indexes: { 'updatedAt': string, 'isFavorite': number };
  };
  sceneEntries: {
    key: number;
    value: any;
    indexes: { 'scenarioId': number, 'content_en': string };
  };
  wizardState: {
    key: string;
    value: { id: string; data: any };
  };
  parties: {
    key: number;
    value: any;
    indexes: { 'updatedAt': string };
  };
  bgImages: {
    key: number;
    value: { id?: number; dataUrl: string; createdAt: string };
  };
  sceneSummaries: {
    key: number;
    value: any;
    indexes: { 'chunkIndex': number };
  };
  endings: {
    key: [number, string];
    value: any;
  };
  avatarData: {
    key: string;
    value: any;
  };
  entities: {
    key: number;
    value: any;
    indexes: { 'scenarioId': number };
  };
  universalSaves: {
    key: number;
    value: any;
  };
  modelCache: {
    key: string;
    value: any;
  };
}

let dbPromise: Promise<IDBPDatabase<TRPGDB>> | null = null;

export function initIndexedDB() {
  if (!dbPromise) {
    dbPromise = openDB<TRPGDB>('trpgDB', 22, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('characterData')) db.createObjectStore('characterData', { keyPath: 'id' });
        
        if (!db.objectStoreNames.contains('scenarios')) {
          const store = db.createObjectStore('scenarios', { keyPath: 'scenarioId', autoIncrement: true });
          store.createIndex('updatedAt', 'updatedAt');
          store.createIndex('isFavorite', 'isFavorite');
        }

        if (!db.objectStoreNames.contains('sceneEntries')) {
          const store = db.createObjectStore('sceneEntries', { keyPath: 'entryId', autoIncrement: true });
          store.createIndex('scenarioId', 'scenarioId');
          store.createIndex('content_en', 'content_en');
        }

        if (!db.objectStoreNames.contains('wizardState')) db.createObjectStore('wizardState', { keyPath: 'id' });
        
        if (!db.objectStoreNames.contains('parties')) {
          const store = db.createObjectStore('parties', { keyPath: 'partyId', autoIncrement: true });
          store.createIndex('updatedAt', 'updatedAt');
        }

        if (!db.objectStoreNames.contains('bgImages')) db.createObjectStore('bgImages', { keyPath: 'id', autoIncrement: true });
        
        if (!db.objectStoreNames.contains('sceneSummaries')) {
          const store = db.createObjectStore('sceneSummaries', { keyPath: 'summaryId', autoIncrement: true });
          store.createIndex('chunkIndex', 'chunkIndex');
        }

        if (!db.objectStoreNames.contains('endings')) db.createObjectStore('endings', { keyPath: ['scenarioId', 'type'] });
        
        if (!db.objectStoreNames.contains('avatarData')) db.createObjectStore('avatarData', { keyPath: 'id' });
        
        if (!db.objectStoreNames.contains('entities')) {
          const store = db.createObjectStore('entities', { keyPath: 'entityId', autoIncrement: true });
          store.createIndex('scenarioId', 'scenarioId');
        }

        if (!db.objectStoreNames.contains('universalSaves')) db.createObjectStore('universalSaves', { keyPath: 'slotIndex' });
        
        if (!db.objectStoreNames.contains('modelCache')) db.createObjectStore('modelCache', { keyPath: 'id' });
      },
      blocked() {
        console.warn('[IndexedDB] DB open blocked.');
      },
      blocking() {
        if (dbPromise) {
          dbPromise.then(db => db.close());
        }
      },
    });
  }
  return dbPromise;
}

export async function getDB() {
  if (!dbPromise) {
    return await initIndexedDB();
  }
  return await dbPromise;
}

// --- Scenarios ---
export async function listAllScenarios() {
  const db = await getDB();
  const res = await db.getAll('scenarios');
  res.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  return res;
}

export async function getScenarioById(scenarioId: number) {
  const db = await getDB();
  return await db.get('scenarios', scenarioId);
}

export async function createNewScenario(wizardData: any, title = '新シナリオ') {
  const db = await getDB();
  const now = new Date().toISOString();
  const record = {
    title,
    wizardData: wizardData || {},
    createdAt: now,
    updatedAt: now,
    bookShelfFlag: false,
    hideFromHistoryFlag: false,
    isFavorite: false,
  };
  return await db.add('scenarios', record);
}

export async function updateScenario(scenario: any, noUpdateDateTimeFlag = false) {
  const db = await getDB();
  if (!noUpdateDateTimeFlag) scenario.updatedAt = new Date().toISOString();
  return await db.put('scenarios', scenario);
}

export async function deleteScenarioById(scenarioId: number) {
  const db = await getDB();
  const tx = db.transaction(['scenarios', 'sceneEntries', 'entities', 'endings', 'universalSaves'], 'readwrite');
  
  await tx.objectStore('scenarios').delete(scenarioId);
  
  // Clean up related data
  const sceneEntriesStore = tx.objectStore('sceneEntries');
  const sceneEntriesIdx = sceneEntriesStore.index('scenarioId');
  let cursor = await sceneEntriesIdx.openCursor(IDBKeyRange.only(scenarioId));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }

  const entitiesStore = tx.objectStore('entities');
  const entitiesIdx = entitiesStore.index('scenarioId');
  let eCursor = await entitiesIdx.openCursor(IDBKeyRange.only(scenarioId));
  while (eCursor) {
    await eCursor.delete();
    eCursor = await eCursor.continue();
  }

  const endingsStore = tx.objectStore('endings');
  let edCursor = await endingsStore.openCursor(IDBKeyRange.bound([scenarioId, ''], [scenarioId, '\uffff']));
  while (edCursor) {
    await edCursor.delete();
    edCursor = await edCursor.continue();
  }

  await tx.done;
}

// --- Character Data ---
export async function loadCharacterData() {
  const db = await getDB();
  const result = await db.get('characterData', 'allCharacters');
  let data = result ? result.data : [];
  
  // マイグレーション: 過去のガチャで引いたカードなど、groupが未設定のものを救出
  // また、ガチャ画面の一時状態である flipped (裏返し) が true で保存されている場合は解除する
  let needsSave = false;
  data = data.map((c: any) => {
    let modified = { ...c };
    
    // groupが未設定、または予期せぬ値の場合は強制的に Warehouse にする
    if (!c.group || !['Warehouse', 'Trash', 'Party'].includes(c.group)) {
      needsSave = true;
      modified.group = 'Warehouse';
      modified.level = c.level || 1;
      modified.exp = c.exp || 0;
      modified.createdAt = c.createdAt || new Date().toISOString();
    }
    
    // パーティ機能の廃止に伴うマイグレーション
    if (modified.group === 'Party') {
      needsSave = true;
      modified.group = 'Warehouse';
      delete modified.partyId;
    }

    if (modified.flipped === true) {
      needsSave = true;
      modified.flipped = false;
    }
    
    // typeの正規化（英語などで保存されてしまったものを日本語タブ名に修正）
    const origType = (modified.type || '').trim();
    if (origType.match(/item|アイテム/i)) {
      if (modified.type !== 'アイテム') {
        modified.type = 'アイテム';
        needsSave = true;
      }
    } else if (origType.match(/monster|モンスター/i)) {
      if (modified.type !== 'モンスター') {
        modified.type = 'モンスター';
        needsSave = true;
      }
    } else {
      // アイテムでもモンスターでもないものは、AIの出力揺れ（「戦士」「NPC」等）とみなし
      // 全て強制的に「キャラクター」として扱い、迷子を防ぐ
      if (origType !== 'キャラクター') {
        modified.type = 'キャラクター';
        needsSave = true;
      } else if (modified.type !== 'キャラクター') {
        // 空白が含まれていた場合は修正して保存
        modified.type = 'キャラクター';
        needsSave = true;
      }
    }

    return modified;
  });

  // 自動保存してDBを更新しておく
  if (needsSave && data.length > 0) {
    await db.put('characterData', { id: 'allCharacters', data });
  }

  return data;
}

export async function saveCharacterData(data: any[]) {
  const db = await getDB();
  await db.put('characterData', { id: 'allCharacters', data });
}

// --- Avatar Data ---
export async function loadAvatarData(id: string = 'myAvatar') {
  const db = await getDB();
  const res = await db.get('avatarData', id);
  return res || null;
}

export async function saveAvatarData(data: any) {
  const db = await getDB();
  await db.put('avatarData', data);
}

// --- Parties ---
export async function listAllParties() {
  const db = await getDB();
  const res = await db.getAll('parties');
  res.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  return res;
}

export async function getPartyById(partyId: number) {
  const db = await getDB();
  return await db.get('parties', partyId);
}

export async function createParty(name: string) {
  const db = await getDB();
  const partyId = Date.now();
  const now = new Date().toISOString();
  await db.add('parties', {
    partyId,
    name,
    createdAt: now,
    updatedAt: now,
  });
  return partyId;
}

export async function updateParty(partyId: number, newName: string) {
  const db = await getDB();
  const party = await db.get('parties', partyId);
  if (party) {
    party.name = newName;
    party.updatedAt = new Date().toISOString();
    await db.put('parties', party);
  }
}

export async function deletePartyById(partyId: number) {
  const db = await getDB();
  await db.delete('parties', partyId);
}

// --- Scene Entries ---
export async function getSceneEntriesByScenarioId(scenarioId: number) {
  const db = await getDB();
  const tx = db.transaction('sceneEntries', 'readonly');
  const index = tx.store.index('scenarioId');
  const entries = await index.getAll(scenarioId);
  entries.sort((a, b) => (a.entryId || 0) - (b.entryId || 0));
  return entries;
}

export async function addSceneEntry(entry: any) {
  const db = await getDB();
  return await db.add('sceneEntries', entry);
}

export async function updateSceneEntry(entry: any) {
  const db = await getDB();
  return await db.put('sceneEntries', entry);
}

export async function deleteSceneEntry(entryId: number) {
  const db = await getDB();
  return await db.delete('sceneEntries', entryId);
}

// --- Scene Summaries ---
export async function addSceneSummaryRecord(summaryObj: any) {
  const db = await getDB();
  return await db.add('sceneSummaries', summaryObj);
}

export async function getSceneSummaryByChunkIndex(chunkIndex: number) {
  const db = await getDB();
  const tx = db.transaction('sceneSummaries', 'readonly');
  const index = tx.store.index('chunkIndex');
  const entries = await index.getAll(IDBKeyRange.only(chunkIndex));
  return entries.length > 0 ? entries[0] : null;
}

export async function updateSceneSummaryRecord(summaryObj: any) {
  const db = await getDB();
  return await db.put('sceneSummaries', summaryObj);
}

export async function deleteSceneSummaryByChunkIndex(chunkIndex: number) {
  const db = await getDB();
  const tx = db.transaction('sceneSummaries', 'readwrite');
  const index = tx.store.index('chunkIndex');
  let cursor = await index.openCursor(IDBKeyRange.only(chunkIndex));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

// --- Endings ---
export async function getEnding(scenarioId: number, type: string) {
  const db = await getDB();
  return await db.get('endings', [scenarioId, type]);
}

export async function saveEnding(scenarioId: number, type: string, story: string) {
  const db = await getDB();
  const rec = { scenarioId, type, story, createdAt: new Date().toISOString() };
  return await db.put('endings', rec);
}

export async function deleteEnding(scenarioId: number, type: string) {
  const db = await getDB();
  return await db.delete('endings', [scenarioId, type]);
}

// --- Entities ---
export async function addEntity(entity: any) {
  const db = await getDB();
  return await db.add('entities', entity);
}

export async function updateEntity(entity: any) {
  const db = await getDB();
  return await db.put('entities', entity);
}

export async function getEntitiesByScenarioId(scenarioId: number) {
  const db = await getDB();
  const tx = db.transaction('entities', 'readonly');
  const index = tx.store.index('scenarioId');
  return await index.getAll(IDBKeyRange.only(scenarioId));
}

export async function deleteEntity(entityId: number) {
  const db = await getDB();
  return await db.delete('entities', entityId);
}

// --- Background Images (bgImages) ---
export async function addBgImage(dataUrl: string) {
  const db = await getDB();
  const rec = { dataUrl, createdAt: new Date().toISOString() };
  return await db.add('bgImages', rec);
}

export async function getAllBgImages() {
  const db = await getDB();
  const res = await db.getAll('bgImages');
  res.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return res;
}

export async function getBgImageById(id: number) {
  const db = await getDB();
  return await db.get('bgImages', id);
}

export async function deleteBgImage(id: number) {
  const db = await getDB();
  return await db.delete('bgImages', id);
}

// --- Universal Saves (Slots 1-5) ---
export interface SaveSlotData {
  slotIndex: number;
  scenarioId: number;
  title: string;
  timestamp: string;
  scenarioData: any;
  sceneEntries: any[];
  entities: any[];
}

export async function getAllSaveSlots(): Promise<(SaveSlotData | undefined)[]> {
  const db = await getDB();
  const slots = [];
  for (let i = 1; i <= 5; i++) {
    slots.push(await db.get('universalSaves', i));
  }
  return slots;
}

export async function saveToSlot(slotIndex: number, scenarioId: number) {
  const db = await getDB();
  
  const scenarioData = await db.get('scenarios', scenarioId);
  if (!scenarioData) throw new Error('Scenario not found');

  const tx1 = db.transaction('sceneEntries', 'readonly');
  const sceneEntriesIdx = tx1.store.index('scenarioId');
  const sceneEntries = await sceneEntriesIdx.getAll(IDBKeyRange.only(scenarioId));

  const tx2 = db.transaction('entities', 'readonly');
  const entitiesIdx = tx2.store.index('scenarioId');
  const entities = await entitiesIdx.getAll(IDBKeyRange.only(scenarioId));

  const saveRecord: SaveSlotData = {
    slotIndex,
    scenarioId,
    title: scenarioData.title || `シナリオ ${scenarioId}`,
    timestamp: new Date().toISOString(),
    scenarioData,
    sceneEntries,
    entities
  };

  await db.put('universalSaves', saveRecord);
}

export async function loadFromSlot(slotIndex: number): Promise<number | null> {
  const db = await getDB();
  const slotData = await db.get('universalSaves', slotIndex);
  if (!slotData) return null;

  const { scenarioId, scenarioData, sceneEntries, entities } = slotData as SaveSlotData;

  const tx = db.transaction(['scenarios', 'sceneEntries', 'entities'], 'readwrite');
  
  // 1. Restore Scenario
  await tx.objectStore('scenarios').put(scenarioData);

  // 2. Clear current scene entries for this scenario
  const sceneStore = tx.objectStore('sceneEntries');
  const sceneIdx = sceneStore.index('scenarioId');
  let sCursor = await sceneIdx.openCursor(IDBKeyRange.only(scenarioId));
  while (sCursor) {
    await sCursor.delete();
    sCursor = await sCursor.continue();
  }
  // Insert saved scene entries
  for (const entry of sceneEntries) {
    await sceneStore.put(entry);
  }

  // 3. Clear current entities for this scenario
  const entityStore = tx.objectStore('entities');
  const entityIdx = entityStore.index('scenarioId');
  let eCursor = await entityIdx.openCursor(IDBKeyRange.only(scenarioId));
  while (eCursor) {
    await eCursor.delete();
    eCursor = await eCursor.continue();
  }
  // Insert saved entities
  for (const ent of entities) {
    await entityStore.put(ent);
  }

  await tx.done;
  return scenarioId;
}

// ==========================================
// Export / Import
// ==========================================
export async function exportAllData(): Promise<string> {
  const db = await initIndexedDB();
  const stores = ['scenarios', 'sceneEntries', 'sceneSummaries', 'entities', 'endings', 'parties', 'bgImages', 'avatarData'] as const;
  const exportData: Record<string, any> = {};

  for (const storeName of stores) {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    exportData[storeName] = await store.getAll();
  }

  // localStorage based characters
  exportData['characters'] = await loadCharacterData();

  return JSON.stringify(exportData);
}

export async function importAllData(jsonData: string): Promise<void> {
  const data = JSON.parse(jsonData);
  const db = await initIndexedDB();
  const stores = ['scenarios', 'sceneEntries', 'sceneSummaries', 'entities', 'endings', 'parties', 'bgImages', 'avatarData'] as const;

  for (const storeName of stores) {
    if (data[storeName]) {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      // Clear existing
      await store.clear();
      // Add new
      for (const item of data[storeName]) {
        await store.put(item);
      }
      await tx.done;
    }
  }

  if (data['characters']) {
    await saveCharacterData(data['characters']);
  }
}

export async function clearAllData(): Promise<void> {
  const db = await initIndexedDB();
  const stores = ['scenarios', 'sceneEntries', 'sceneSummaries', 'entities', 'endings', 'parties', 'universalSaves', 'bgImages', 'avatarData'] as const;

  for (const storeName of stores) {
    const tx = db.transaction(storeName, 'readwrite');
    await tx.objectStore(storeName).clear();
    await tx.done;
  }

  // localStorage 側の保存データもクリア
  localStorage.removeItem('allCharacters');
  localStorage.removeItem('myAvatar');
  localStorage.removeItem('tutorial_completed_basic');
  localStorage.removeItem('bookshelf_scenario_order');
  localStorage.removeItem('elementStageArr');
  localStorage.removeItem('elementMood');
  localStorage.removeItem('llm_config');
  localStorage.removeItem('stabilityApiKey');
  localStorage.removeItem('bgmStopped');
}

// ==========================================
// Scenario Duplicate & ZIP Export/Import
// ==========================================

export async function duplicateScenario(scenarioId: number): Promise<void> {
  const db = await initIndexedDB();
  
  const txRead = db.transaction(['scenarios', 'sceneEntries', 'entities', 'endings'], 'readonly');
  const scenario = await txRead.objectStore('scenarios').get(scenarioId);
  if (!scenario) throw new Error('シナリオが見つかりません');
  
  const entries = await txRead.objectStore('sceneEntries').index('scenarioId').getAll(scenarioId);
  const entities = await txRead.objectStore('entities').index('scenarioId').getAll(scenarioId);
  const endingsAll = await txRead.objectStore('endings').getAll();
  const endings = endingsAll.filter(e => e.scenarioId === scenarioId);
  await txRead.done;

  const txWrite = db.transaction(['scenarios', 'sceneEntries', 'entities', 'endings'], 'readwrite');
  
  // Create new scenario
  const newScenario = { ...scenario };
  delete newScenario.scenarioId;
  newScenario.title = `${newScenario.title} (コピー)`;
  newScenario.updatedAt = new Date().toISOString();
  
  const newId = await txWrite.objectStore('scenarios').put(newScenario);

  // Copy entries
  for (const e of entries) {
    const newE = { ...e, scenarioId: newId };
    delete newE.entryId;
    await txWrite.objectStore('sceneEntries').put(newE);
  }

  // Copy entities
  for (const ent of entities) {
    const newEnt = { ...ent, scenarioId: newId };
    delete newEnt.entityId;
    await txWrite.objectStore('entities').put(newEnt);
  }

  // Copy endings
  for (const end of endings) {
    const newEnd = { ...end, scenarioId: newId };
    await txWrite.objectStore('endings').put(newEnd);
  }

  await txWrite.done;
}

export async function exportScenarioAsZip(scenarioId: number, includeImages: boolean): Promise<Blob> {
  const db = await initIndexedDB();
  const zip = new JSZip();

  const tx = db.transaction(['scenarios', 'sceneEntries', 'entities', 'endings', 'sceneSummaries'], 'readonly');
  const scenario = await tx.objectStore('scenarios').get(scenarioId);
  if (!scenario) throw new Error('シナリオが見つかりません');
  
  const entries = await tx.objectStore('sceneEntries').index('scenarioId').getAll(scenarioId);
  const entities = await tx.objectStore('entities').index('scenarioId').getAll(scenarioId);
  const endingsAll = await tx.objectStore('endings').getAll();
  const endings = endingsAll.filter(e => e.scenarioId === scenarioId);
  const summaries = await tx.objectStore('sceneSummaries').getAll(); // In a real app, might want to filter by scenario, but chunkIndex is global in this schema.
  await tx.done;

  // Cleanup image data if not included
  if (!includeImages) {
    if (scenario.bgImageBase64) delete scenario.bgImageBase64;
    entities.forEach(ent => {
      if (ent.imageData) delete ent.imageData;
    });
  }

  const exportData = {
    scenario,
    entries,
    entities,
    endings,
    summaries
  };

  zip.file('scenario_data.json', JSON.stringify(exportData, null, 2));
  return zip.generateAsync({ type: 'blob' });
}

export async function importScenarioFromZip(file: File): Promise<void> {
  const zip = await JSZip.loadAsync(file);
  const jsonFile = zip.file('scenario_data.json');
  if (!jsonFile) throw new Error('ZIP内に scenario_data.json が見つかりません。有効なシナリオZIPではありません。');

  const jsonText = await jsonFile.async('string');
  const data = JSON.parse(jsonText);

  if (!data.scenario) throw new Error('シナリオデータが不正です');

  const db = await initIndexedDB();
  const tx = db.transaction(['scenarios', 'sceneEntries', 'entities', 'endings'], 'readwrite');
  
  const newScenario = { ...data.scenario };
  delete newScenario.scenarioId; // Always assign new ID
  newScenario.title = `${newScenario.title} (Imported)`;
  newScenario.updatedAt = new Date().toISOString();

  const newId = await tx.objectStore('scenarios').put(newScenario);

  if (data.entries) {
    for (const e of data.entries) {
      const newE = { ...e, scenarioId: newId };
      delete newE.entryId;
      await tx.objectStore('sceneEntries').put(newE);
    }
  }

  if (data.entities) {
    for (const ent of data.entities) {
      const newEnt = { ...ent, scenarioId: newId };
      delete newEnt.entityId;
      await tx.objectStore('entities').put(newEnt);
    }
  }

  if (data.endings) {
    for (const end of data.endings) {
      const newEnd = { ...end, scenarioId: newId };
      await tx.objectStore('endings').put(newEnd);
    }
  }

  // Summaries might be cross-scenario, but if exported with this scenario, we can optionally restore them.
  // In our schema, they don't have scenarioId, just chunkIndex. So we just put them as is.
  if (data.summaries) {
    const txSum = db.transaction('sceneSummaries', 'readwrite');
    for (const sum of data.summaries) {
      // Avoid overwriting existing chunks if possible, or just overwrite.
      await txSum.objectStore('sceneSummaries').put(sum);
    }
    await txSum.done;
  }

  await tx.done;
}

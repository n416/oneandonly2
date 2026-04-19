import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Trash2, Edit2, Check, X, Briefcase } from 'lucide-react';
import pako from 'pako';
import { 
  getScenarioById, getSceneEntriesByScenarioId, addSceneEntry, updateScenario, updateSceneEntry, deleteSceneEntry,
  getSceneSummaryByChunkIndex, addSceneSummaryRecord, addEntity, getEntitiesByScenarioId, getEnding, saveEnding,
  updateEntity, deleteEntity, saveCharacterData, loadCharacterData
} from '../lib/indexedDB';
import { useLLM } from '../hooks/useLLM';
import { useUI } from '../contexts/UIContext';
import { StabilityApiClient } from '../lib/stabilityApiClient';

interface SceneEntry {
  entryId?: number;
  scenarioId: number;
  type: string;
  sceneId: string;
  content: string;
  content_en?: string;
  actionContent?: string;
  actionContent_en?: string;
}

function decompressCondition(zippedBase64?: string): string {
  if (!zippedBase64) return '';
  try {
    const bin = atob(zippedBase64);
    const uint8 = new Uint8Array([...bin].map((c) => c.charCodeAt(0)));
    const inf = pako.inflate(uint8);
    return new TextDecoder().decode(inf);
  } catch (e) {
    console.error('decompress fail:', e);
    return '(解凍エラー)';
  }
}

export default function ScenarioPlay() {
  const { scenarioId } = useParams<{ scenarioId: string }>();
  const navigate = useNavigate();
  const { generateResponse, isGenerating } = useLLM();

  const [scenario, setScenario] = useState<any>(null);
  const [sceneHistory, setSceneHistory] = useState<SceneEntry[]>([]);
  const [playerInput, setPlayerInput] = useState('');
  const [isSectionChecking, setIsSectionChecking] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGeneratingBg, setIsGeneratingBg] = useState(false);
  const [hasStartedOpening, setHasStartedOpening] = useState(false);
  const [showEndingType, setShowEndingType] = useState<'clear'|'bad'|null>(null);
  const [endingText, setEndingText] = useState('');
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [editTempText, setEditTempText] = useState('');
  const [editingType, setEditingType] = useState<'action' | 'content' | null>(null);

  // アイテム関連
  const [acquiredItems, setAcquiredItems] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showInventory, setShowInventory] = useState(false);
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);

  const [isEntitiesModalOpen, setIsEntitiesModalOpen] = useState(false);
  const [entitiesList, setEntitiesList] = useState<any[]>([]);
  const [isGetCardModalOpen, setIsGetCardModalOpen] = useState(false);

  const { toast, confirm, alert } = useUI();

  const historyEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!scenarioId) return;
      const sc = await getScenarioById(Number(scenarioId));
      if (!sc) {
        await alert('シナリオが見つかりません');
        navigate('/bookshelf');
        return;
      }
      setScenario(sc);

      const entries = await getSceneEntriesByScenarioId(Number(scenarioId));
      const scenes = entries.filter((e: any) => e.type === 'scene');
      setSceneHistory(scenes);

      // 初回のみ（履歴が0件の場合）オープニングを生成
      if (scenes.length === 0 && !hasStartedOpening) {
        setHasStartedOpening(true);
        // handleNextScene は状態に依存するため、非同期で少し待つか、
        // あるいは独立した初期化用関数を呼ぶ方が良いが、
        // ここでは state の更新がキューに入った後、直接呼び出す
        setTimeout(() => {
          handleNextScene('（ゲーム開始。シナリオの魅力的なオープニングシーンから描写をスタートしてください。）', true);
        }, 100);
      }
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioId, navigate]);

  useEffect(() => {
    const loadItems = async () => {
      if (!scenarioId || !scenario) return;
      const ents = await getEntitiesByScenarioId(Number(scenarioId));
      const items = ents.filter(e => e.category === 'item' && e.acquired);
      
      const pArr = scenario.wizardData?.party || [];
      const partyItems = pArr.filter((c: any) => c.type === 'アイテム');
      
      const result: any[] = [];
      const addedNames = new Set();
      
      for (const it of partyItems) {
        const nm = it.name || '無名アイテム';
        if (!addedNames.has(nm)) {
          addedNames.add(nm);
          result.push({ name: nm, description: it.caption || it.special || '', imageData: it.imageData });
        }
      }
      for (const it of items) {
        const nm = it.name || '無名アイテム';
        if (!addedNames.has(nm)) {
          addedNames.add(nm);
          result.push({ name: nm, description: it.description || '', imageData: it.imageData });
        }
      }
      setAcquiredItems(result);
    };
    loadItems();
  }, [scenarioId, scenario, sceneHistory.length, isExtracting]);

  const handleUpdateScene = async (scn: SceneEntry, newText: string, isAction: boolean) => {
    if (!scn.entryId) return;
    const oldText = isAction ? scn.actionContent : scn.content;
    if (newText.trim() === (oldText || '').trim()) return;
    
    if (isAction) scn.actionContent = newText;
    else scn.content = newText;
    
    await updateSceneEntry(scn);
    setSceneHistory(prev => [...prev]); // 再描画
    setEditingEntryId(null);
  };

  const handleDeleteScene = async (scn: SceneEntry) => {
    if (!scn.entryId) return;
    const ok = await confirm('このシーン以降の履歴をすべて削除して、展開を巻き戻しますか？');
    if (!ok) return;
    
    // このシーンのID以降のエントリーをすべて削除
    const entryIdToRollback = scn.entryId;
    const toDelete = sceneHistory.filter(s => (s.entryId || 0) >= entryIdToRollback);
    
    for (const d of toDelete) {
      if (d.entryId) await deleteSceneEntry(d.entryId);
    }
    
    setSceneHistory(prev => prev.filter(s => (s.entryId || 0) < entryIdToRollback));
  };

  const startEditing = (scn: SceneEntry, type: 'action' | 'content') => {
    if (!scn.entryId) return;
    setEditingEntryId(scn.entryId);
    setEditingType(type);
    setEditTempText(type === 'action' ? (scn.actionContent || '') : scn.content);
  };

  useEffect(() => {
    // Scroll to bottom when history changes
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sceneHistory, isGenerating]);

  const handleNextScene = async (overrideInput?: string, isOpening: boolean = false) => {
    const input = overrideInput || playerInput;
    if (!input.trim() || !scenario || isGenerating) return;

    const wd = scenario.wizardData || {};
    const sections = wd.sections || [];

    let systemText = `あなたは経験豊富なTRPGゲームマスター(GM)です。以下のルールに従い、プレイヤーの行動に対する次のシーンを生成してください。
ルール:
- 背景黒が前提の、読みやすい文字のHTML的な装飾をする。style直書きで良い。
- 出力は必ず日本語。
- シナリオ設定と過去の展開との整合性を保つ。
- プレイヤーの行動の結果を具体的に描写する。
- 新たな状況や登場人物、選択肢を提示し、物語を進展させる。
- 時々パーティメンバーの短い会話や反応を含める。
- メタ的な発言(GMとしての説明など)はしない。
- 最後の文節はプレイヤーに次の行動を促す問いかけで終わることが望ましいが、選択肢は不要。
- 必要に応じて【セクション目標】の達成に繋がるヒントを自然に含める。
======
`;

    if (sections.length > 0) {
      systemText += '【現在のセクション目標】\n';
      sections.forEach((s: any) => {
        const status = s.cleared ? '(達成済)' : '(未達成)';
        const cond = s.condition || decompressCondition(s.conditionZipped) || '?';
        systemText += `- セクション${s.number}${status}: ${cond}\n`;
      });
      systemText += '======\n';
    }

    let prompt = systemText + '\n--- シナリオ情報 ---\n';
    prompt += `概要: ${wd.scenarioSummary || '(概要なし)'}\n`;
    if (wd.party && wd.party.length > 0) {
      prompt += 'パーティメンバー:\n';
      wd.party.forEach((p: any) => {
        prompt += `- ${p.name} (${p.type}): ${p.special || p.caption}\n`;
      });
    }

    // 過去の要約を追加
    let summaryText = '';
    const chunkEnd = Math.floor((Math.max(0, sceneHistory.length - 15)) / 10);
    for (let i = 0; i <= chunkEnd; i++) {
      const sum = await getSceneSummaryByChunkIndex(i);
      if (sum) {
        summaryText += sum.content_ja + '\n';
      }
    }
    if (summaryText) {
      prompt += '\n--- 過去の要約 ---\n' + summaryText;
    }

    prompt += '\n--- 最近の展開 ---\n';
    // 直近15件だけを送る
    const recentScenes = sceneHistory.slice(-15);
    recentScenes.forEach(scn => {
      if (scn.actionContent) prompt += `プレイヤー: ${scn.actionContent}\n`;
      prompt += `GM: ${scn.content}\n`;
    });

    prompt += '\n--- 今回の行動 ---\n';
    let finalInput = input.trim();
    if (!isOpening && selectedItem && finalInput) {
      finalInput = `【アイテム「${selectedItem.name}」を使用】${finalInput}`;
    }
    prompt += `プレイヤー: ${finalInput}\n`;
    prompt += '--- 次のシーン ---\nGM:';

    const actionTextJa = isOpening ? '' : finalInput;
    if (!isOpening) {
      setPlayerInput('');
      setSelectedItem(null);
    }

    try {
      const result = await generateResponse(prompt, []);
      if (!result) throw new Error('APIから応答がありません');

      const sceneIdHash = `scene_${Date.now()}`;
      const newEntry: SceneEntry = {
        scenarioId: Number(scenarioId),
        type: 'scene',
        sceneId: sceneIdHash,
        content: result,
        actionContent: actionTextJa,
      };

      const entryId = await addSceneEntry(newEntry);
      newEntry.entryId = entryId;

      setSceneHistory(prev => [...prev, newEntry]);

      // シナリオの更新日時を更新
      const updatedScenario = { ...scenario, updatedAt: new Date().toISOString() };
      await updateScenario(updatedScenario);
      setScenario(updatedScenario);

      // セクションクリア判定を非同期で実行
      checkSectionClearAsync(updatedScenario, actionTextJa, result);

      // 要約の生成を非同期で実行
      handleSceneSummaries([...sceneHistory, newEntry]);

    } catch (e: any) {
      console.error(e);
      toast(`シーン生成エラー: ${e.message}`, 'error');
      setPlayerInput(actionTextJa); // エラー時は入力を戻す
    }
  };

  const checkSectionClearAsync = async (currentScenario: any, actionTextJa: string, sceneTextJa: string) => {
    setIsSectionChecking(true);
    try {
      const wd = currentScenario.wizardData;
      if (!wd?.sections) return;
      const sorted = [...wd.sections].sort((a, b) => (a.number || 0) - (b.number || 0));
      const firstUncleared = sorted.find((s) => !s.cleared);
      if (!firstUncleared) return;

      const cond = firstUncleared.condition || decompressCondition(firstUncleared.conditionZipped) || '?';

      const prompt = `あなたはTRPGの審判AIです。以下の情報に基づき、提示された「達成条件」がプレイヤーの行動や状況によって満たされたかどうかを判断し、**YESかNOのみ**で答えてください。

シナリオ概要:
${wd.scenarioSummary || '(概要なし)'}

達成条件(セクション${firstUncleared.number}):
「${cond}」

最新のプレイヤー行動:
${actionTextJa || '(行動なし)'}

最新のシーン状況:
${sceneTextJa || '(シーンなし)'}

質問: この達成条件は満たされましたか？ (YES/NO)`;

      const answer = (await generateResponse(prompt, []))?.trim().toUpperCase() || '';
      
      if (answer.startsWith('YES')) {
        firstUncleared.cleared = true;
        const updatedScenario = { ...currentScenario, wizardData: { ...wd, sections: sorted } };
        await updateScenario(updatedScenario);
        setScenario(updatedScenario);
        toast(`🎉 セクション${firstUncleared.number} をクリアしました！`, 'success');
      }
    } catch (e) {
      console.error('Section clear check failed:', e);
    } finally {
      setIsSectionChecking(false);
    }
  };

  const handleSceneSummaries = async (history: SceneEntry[]) => {
    const actionCount = history.filter((s) => s.actionContent?.trim()).length;
    if (actionCount < 15) return;

    const chunkIndex = Math.floor((actionCount - 15) / 10);
    if (chunkIndex >= 0) {
      const existing = await getSceneSummaryByChunkIndex(chunkIndex);
      if (!existing) {
        const startAction = chunkIndex * 10 + 1;
        const endAction = (chunkIndex + 1) * 10;
        let gatheredTextJa = '';
        let aCounter = 0;
        for (const scn of history) {
          if (scn.actionContent?.trim()) aCounter++;
          if (aCounter >= startAction && aCounter <= endAction) {
            if (scn.actionContent?.trim()) gatheredTextJa += `\nP:${scn.actionContent}`;
            gatheredTextJa += `\nS:${scn.content}`;
          }
        }
        
        const prompt = `以下のゲーム進行テキストを日本語で5行程度に要約してください。重要な出来事や結果に焦点を当ててください:\n---\n${gatheredTextJa}\n---\n要約:`;
        try {
          const summary = await generateResponse(prompt, []);
          await addSceneSummaryRecord({ chunkIndex, content_ja: summary.trim() });
        } catch (e) {
          console.error('Summary generation failed', e);
        }
      }
    }
  };

  const handleExtractEntities = async () => {
    if (!scenarioId || sceneHistory.length === 0) return;
    setIsExtracting(true);
    try {
      const existingEntities = await getEntitiesByScenarioId(Number(scenarioId));
      const existingDesc = existingEntities.map(e => `${e.name}(${e.category}): ${e.description.substring(0, 30)}...`).join('\n') || '（なし）';

      let scenarioText = '';
      sceneHistory.slice(-20).forEach(scn => {
        if (scn.actionContent) scenarioText += `\nP:${scn.actionContent}\n`;
        scenarioText += `S:${scn.content}\n`;
      });

      const prompt = `あなたはTRPGの情報を整理するAIです。以下のシナリオテキスト全体を読み、物語に登場した重要な【アイテム】や【キャラクター】(モンスター含む)を抽出してください。既に抽出済みのリストも参考に、重複を避け、新たに見つかったものだけをリストアップしてください。\n\n抽出済リスト:\n${existingDesc}\n\nシナリオテキスト:\n---\n${scenarioText}\n---\n\n出力形式は以下のJSON配列形式のみとしてください。説明や前置きは不要です。日本語で記述し、固有名詞が英語の場合はカタカナにしてください。プレイヤーが入手したと思われるアイテムには "acquired": true を設定してください。\n例: [{"category":"item","name":"古い鍵","description":"錆びついた銅製の鍵。","acquired":true}, {"category":"character","name":"ゴブリン","description":"小柄で緑色の肌を持つモンスター。","acquired":false}]\n\n新たに見つかったエンティティリスト(JSON配列):`;
      
      const response = await generateResponse(prompt, []);
      const jsonMatch = response.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (jsonMatch && jsonMatch[0]) {
        const newEntities = JSON.parse(jsonMatch[0]);
        let addedCount = 0;
        for (const e of newEntities) {
          if (e.name && e.category) {
            await addEntity({
              scenarioId: Number(scenarioId),
              category: e.category === 'character' || e.category === 'モンスター' ? 'character' : 'item',
              name: e.name,
              description: e.description || '',
              acquired: e.acquired === true,
              imageData: ''
            });
            addedCount++;
          }
        }
        toast(`${addedCount}件の新しいアイテム/登場人物を抽出・登録しました！倉庫から確認できます。`, 'success');
        if (isEntitiesModalOpen) loadEntities();
      } else {
        toast('新しく追加できそうなアイテム・登場人物は見つかりませんでした。', 'info');
      }
    } catch (e: any) {
      console.error(e);
      toast('抽出エラー: ' + e.message, 'error');
    } finally {
      setIsExtracting(false);
    }
  };

  const loadEntities = async () => {
    if (!scenarioId) return;
    try {
      const ents = await getEntitiesByScenarioId(Number(scenarioId));
      setEntitiesList(ents);
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateEntityImage = async (entity: any) => {
    const promptEn = await generateResponse(`あなたは翻訳者です。次のテキストを画像生成用のカンマ区切りの英語プロンプトに翻訳してください。文章ではなく英単語の羅列で出力してください。\n${entity.name}: ${entity.description}`, []);
    const prompt = `high quality, masterpiece, concept art, solo, ${promptEn.trim()}`;
    try {
      const apiKey = localStorage.getItem('stabilityApiKey');
      if (!apiKey) {
        toast('Stability AIのAPIキーが設定されていません', 'error');
        return;
      }
      toast('画像生成中...', 'info');
      const client = new StabilityApiClient();
      const results = await client.generateImage(prompt, apiKey, { width: 512, height: 512, style_preset: 'anime' });
      if (results && results.length > 0) {
        const dataUrl = 'data:image/png;base64,' + results[0].imageDataB64;
        const updated = { ...entity, imageData: dataUrl };
        await updateEntity(updated);
        toast('画像を生成しました', 'success');
        loadEntities();
      }
    } catch (e: any) {
      toast('画像生成失敗: ' + e.message, 'error');
    }
  };

  const handleDeleteEntity = async (entityId: number) => {
    if (await confirm('この情報を削除してよろしいですか？')) {
      await deleteEntity(entityId);
      loadEntities();
      toast('削除しました', 'success');
    }
  };

  const handleSaveAsCard = async (entity: any) => {
    try {
      const newChar = {
        id: crypto.randomUUID(),
        name: entity.name,
        type: entity.category === 'character' ? 'キャラクター' : 'アイテム',
        skill: entity.description,
        serif: '',
        rarity: 3,
        level: 1,
        exp: 0,
        group: 'Warehouse',
        partyId: 0,
        imageData: entity.imageData || '',
        createdAt: new Date().toISOString()
      };
      
      const allData = await loadCharacterData();
      allData.push(newChar);
      await saveCharacterData(allData);
      
      toast(`${entity.name} をカードとして取得しました！倉庫で確認できます。`, 'success');
      setIsGetCardModalOpen(false);
    } catch (e: any) {
      toast('カード保存失敗: ' + e.message, 'error');
    }
  };

  const handleGenerateEnding = async (type: 'clear' | 'bad') => {
    if (!scenarioId || !scenario) return;
    setShowEndingType(type);
    try {
      const existing = await getEnding(Number(scenarioId), type);
      if (existing) {
        setEndingText(existing.story);
        return;
      }

      const wd = scenario.wizardData || {};
      const endTypePrompt = type === 'clear' ? '感動的でハッピーな結末' : '後味の悪い、または悲劇的なバッドエンド';
      
      let sectionText = '';
      if (wd.sections) {
        sectionText = wd.sections.map((s: any) => `・S${s.number}(${s.cleared ? '済' : '未'}): ${decompressCondition(s.conditionZipped) || '?'}`).join('\n');
      }

      let partyText = 'なし';
      if (wd.party && wd.party.length > 0) {
        partyText = wd.party.map((p: any) => `- ${p.name} (${p.type}) ${p.role==='avatar'?'[アバター]':''} ${p.role==='partner'?'[パートナー]':''}`).join('\n');
      }

      let scenarioText = '';
      sceneHistory.slice(-10).forEach(scn => {
        if (scn.actionContent) scenarioText += `P:${scn.actionContent}\n`;
        scenarioText += `GM:${scn.content}\n`;
      });

      const prompt = `あなたはTRPGのエンディングを作成するAIです。以下の情報に基づき、指定された結末を迎えるエンディングストーリーを日本語で生成してください。
出力は以下の5部構成で記述してください:
1.【シナリオ概要の再確認】: 提供された概要を簡潔に。
2.【パーティメンバーの結末】: 各メンバーがどうなったか、個別に描写。
3.【物語の結末(${endTypePrompt})】: 指定された結末に至る経緯と最終的な状況を描写。
4.【セクション達成状況】: 提供されたセクション情報への言及（任意）。
5.【エピローグ】: 物語全体の締めくくりや、その後の世界について一言。

---
シナリオ概要: ${wd.scenarioSummary || '(概要なし)'}
パーティ情報: 
${partyText}
直近の展開(最大10シーン):
${scenarioText || '(なし)'}
セクション情報:
${sectionText}
---

エンディングストーリー(${endTypePrompt}):`;

      const story = await generateResponse(prompt, []);
      setEndingText(story);
      await saveEnding(Number(scenarioId), type, story);
    } catch (e: any) {
      console.error(e);
      toast('エンディング生成エラー: ' + e.message, 'error');
      setShowEndingType(null);
    }
  };

  const areAllSectionsCleared = () => {
    if (!scenario?.wizardData?.sections) return false;
    return scenario.wizardData.sections.every((s: any) => s.cleared);
  };

  const handleGenerateBackground = async () => {
    if (!scenarioId || sceneHistory.length === 0) return;
    
    const apiKey = localStorage.getItem('stabilityApiKey');
    if (!apiKey) {
      await alert("SettingsからStability AIのAPIキーを設定してください。");
      return;
    }

    const client = new StabilityApiClient();
    if (!client.isAvailable) {
      await alert("APIキーが未設定です。");
      return;
    }

    setIsGeneratingBg(true);
    try {
      // 最新のシーンを元にプロンプトを作成
      const lastScene = sceneHistory[sceneHistory.length - 1];
      const prompt = `あなたはイラストレーターです。以下のテキストの場面を表現する、背景画像生成用の英語のプロンプトを「カンマ区切りの英単語」で10個程度出力してください。文章ではなく、カンマ区切りの単語のみ出力してください。例: dark forest, fantasy, moonlight, mysterious, high quality, concept art
---
${lastScene.content}`;
      
      const promptEn = await generateResponse(prompt, []);
      const finalPrompt = 'cinematic, beautiful, highly detailed, scenery, background, ' + promptEn.trim();

      toast("背景画像を生成中...", "info");
      
      const results = await client.generateImage(finalPrompt, apiKey, {
        samples: 1,
        width: 1344,
        height: 768,
        style_preset: 'cinematic-photorealistic'
      });

      if (results && results.length > 0) {
        const dataUrl = 'data:image/png;base64,' + results[0].imageDataB64;
        const updatedScenario = { ...scenario, bgImage: dataUrl };
        await updateScenario(updatedScenario);
        setScenario(updatedScenario);
        toast("背景画像を適用しました！", "success");
      }
    } catch (err: any) {
      console.error(err);
      toast("背景生成に失敗: " + err.message, "error");
    } finally {
      setIsGeneratingBg(false);
    }
  };

  if (!scenario) return <div style={{ padding: '24px' }}>読込中...</div>;

  return (
    <div style={{ 
      display: 'flex', flexDirection: 'column', height: '100%', maxWidth: '900px', margin: '0 auto',
      backgroundImage: scenario?.bgImage ? `url(${scenario.bgImage})` : 'none',
      backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed',
      position: 'relative'
    }}>
      {scenario?.bgImage && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 0 }}></div>
      )}
      
      <header className="glass-panel" style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button className="btn btn-glass" onClick={() => navigate('/bookshelf')} style={{ padding: '8px' }} title="本棚に戻る">
              <ArrowLeft size={20} />
            </button>
          </div>
          <div>
            <h1 className="text-display" style={{ fontSize: '1.25rem', margin: 0 }}>{scenario.title}</h1>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className={`btn ${showInventory ? 'btn-primary' : 'btn-glass'}`} 
            onClick={() => setShowInventory(!showInventory)}
            title="持ち物（取得アイテム）を確認する"
          >
            <Briefcase size={16} /> 持ち物 ({acquiredItems.length})
          </button>
          <button 
            className="btn btn-glass" 
            onClick={handleGenerateBackground} 
            disabled={isGeneratingBg || sceneHistory.length === 0}
            title="現在のシーンの情景を描写する背景画像をAIで生成します"
          >
            {isGeneratingBg ? '背景生成中...' : '背景生成'}
          </button>
          <button 
            className="btn btn-glass" 
            onClick={() => { loadEntities(); setIsEntitiesModalOpen(true); }}
            title="現在のシナリオで登場したアイテムやキャラクターの情報を確認します"
          >
            情報
          </button>
          <button 
            className="btn btn-glass" 
            onClick={handleExtractEntities} 
            disabled={isExtracting || sceneHistory.length === 0}
            title="シナリオの文章から、登場したアイテムやキャラクターを抽出して倉庫に保存します"
          >
            {isExtracting ? '抽出中...' : 'カード抽出'}
          </button>
          {areAllSectionsCleared() ? (
            <button className="btn btn-primary" onClick={() => handleGenerateEnding('clear')} disabled={isGenerating}>
              クリアエンディング
            </button>
          ) : (
            <button className="btn btn-glass" style={{ color: '#f44336', borderColor: '#f44336' }} onClick={() => handleGenerateEnding('bad')} disabled={isGenerating}>
              リタイア(BadEnd)
            </button>
          )}
        </div>
      </header>

      {/* 履歴エリア */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', zIndex: 10 }}>
        {sceneHistory.map((scn, idx) => (
          <div key={scn.entryId || idx} style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative' }}>
            {scn.actionContent && (
              <div style={{ alignSelf: 'flex-end', background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '12px 16px', borderRadius: '16px 16px 0 16px', maxWidth: '80%', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#60a5fa' }}>あなた (行動)</div>
                  {editingEntryId !== scn.entryId || editingType !== 'action' ? (
                    <button className="btn btn-glass" style={{ padding: '4px', height: 'auto', border: 'none', color: 'rgba(255,255,255,0.4)' }} onClick={() => startEditing(scn, 'action')}>
                      <Edit2 size={14} />
                    </button>
                  ) : null}
                </div>
                {editingEntryId === scn.entryId && editingType === 'action' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <textarea 
                      className="btn-glass" 
                      style={{ width: '100%', minHeight: '60px', padding: '8px', resize: 'vertical' }}
                      value={editTempText}
                      onChange={e => setEditTempText(e.target.value)}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button className="btn btn-glass" style={{ padding: '4px 8px' }} onClick={() => setEditingEntryId(null)}><X size={14}/></button>
                      <button className="btn btn-primary" style={{ padding: '4px 8px' }} onClick={() => handleUpdateScene(scn, editTempText, true)}><Check size={14}/></button>
                    </div>
                  </div>
                ) : (
                  <div style={{ whiteSpace: 'pre-wrap', outline: 'none' }}>
                    {scn.actionContent}
                  </div>
                )}
              </div>
            )}
            <div className="glass-panel" style={{ padding: '16px', borderRadius: '16px 16px 16px 0', alignSelf: 'flex-start', maxWidth: '90%', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '0.8rem', color: '#a78bfa' }}>ゲームマスター (GM)</div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {editingEntryId !== scn.entryId || editingType !== 'content' ? (
                    <button className="btn btn-glass" style={{ padding: '4px', height: 'auto', color: 'rgba(255,255,255,0.4)', border: 'none', background: 'transparent' }} onClick={() => startEditing(scn, 'content')} title="テキストを編集">
                      <Edit2 size={14} />
                    </button>
                  ) : null}
                  <button 
                    className="btn btn-glass" 
                    style={{ padding: '4px', height: 'auto', color: '#ef4444', border: 'none', background: 'transparent' }}
                    onClick={() => handleDeleteScene(scn)}
                    title="このシーン以降を削除（巻き戻し）"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {editingEntryId === scn.entryId && editingType === 'content' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <textarea 
                    className="btn-glass" 
                    style={{ width: '100%', minHeight: '120px', padding: '8px', resize: 'vertical' }}
                    value={editTempText}
                    onChange={e => setEditTempText(e.target.value)}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button className="btn btn-glass" style={{ padding: '4px 8px' }} onClick={() => setEditingEntryId(null)}><X size={14}/></button>
                    <button className="btn btn-primary" style={{ padding: '4px 8px' }} onClick={() => handleUpdateScene(scn, editTempText, false)}><Check size={14}/></button>
                  </div>
                </div>
              ) : (
                <div 
                  dangerouslySetInnerHTML={{ __html: scn.content }} 
                  style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap', outline: 'none' }} 
                />
              )}
            </div>
          </div>
        ))}

        {isGenerating && (
          <div className="glass-panel animate-pulse" style={{ padding: '16px', borderRadius: '16px 16px 16px 0', alignSelf: 'flex-start', maxWidth: '80%' }}>
            <div style={{ fontSize: '0.8rem', color: '#a78bfa', marginBottom: '8px' }}>ゲームマスター (GM)</div>
            <div style={{ color: 'rgba(255,255,255,0.5)' }}>シーンを生成中...</div>
          </div>
        )}
        <div ref={historyEndRef} />
      </div>

      {/* エンディングモーダル風のオーバーレイ表示 */}
      {showEndingType && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', flexDirection: 'column', padding: '24px'
        }}>
          <h2 className="text-display text-gradient" style={{ textAlign: 'center', marginBottom: '24px' }}>
            {showEndingType === 'clear' ? 'クリアエンディング' : 'バッドエンディング'}
          </h2>
          <div className="glass-panel" style={{ flex: 1, overflowY: 'auto', padding: '24px', whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
            {isGenerating && !endingText ? 'エンディングを生成中...' : endingText}
          </div>
          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-primary" onClick={() => setShowEndingType(null)}>閉じる</button>
              {showEndingType === 'clear' && (
                <button className="btn btn-glass" style={{ color: '#4ade80', borderColor: '#4ade80' }} onClick={() => { loadEntities(); setIsGetCardModalOpen(true); }}>
                  カードを取得する
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 持ち物一覧（表示トグル時） */}
      {showInventory && acquiredItems.length > 0 && (
        <div className="glass-panel" style={{ padding: '12px 16px', margin: '0 16px 12px', display: 'flex', gap: '8px', overflowX: 'auto', zIndex: 10, borderRadius: '12px' }}>
          <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>持ち物:</div>
          {acquiredItems.map((it, idx) => (
            <div 
              key={idx} 
              className={`chip ${selectedItem?.name === it.name ? 'selected' : ''}`}
              style={{ 
                display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '6px 12px', borderRadius: '20px',
                background: selectedItem?.name === it.name ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                border: selectedItem?.name === it.name ? '1px solid rgba(255,255,255,0.8)' : '1px solid transparent',
                transition: 'all 0.2s'
              }}
              onClick={() => setSelectedItem(selectedItem?.name === it.name ? null : it)}
              title={it.description}
            >
              {it.imageData && <img src={it.imageData} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />}
              <span style={{ fontSize: '0.9rem', whiteSpace: 'nowrap' }}>{it.name}</span>
            </div>
          ))}
        </div>
      )}
      {showInventory && acquiredItems.length === 0 && (
         <div className="glass-panel" style={{ padding: '12px 16px', margin: '0 16px 12px', zIndex: 10, borderRadius: '12px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
           取得済みのアイテムはありません。
         </div>
      )}

      {/* 入力エリア */}
      <div className="glass-panel" style={{ padding: '16px', marginTop: 'auto', borderRadius: '16px 16px 0 0', display: 'flex', flexDirection: 'column', gap: '12px', zIndex: 10 }}>
        <label style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)' }}>
          プレイヤーの行動 {selectedItem && <span style={{ color: '#4ade80' }}>（アイテム「{selectedItem.name}」を使用）</span>}
        </label>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
          <textarea
            className="btn-glass"
            style={{ flex: 1, minHeight: '80px', padding: '12px', textAlign: 'left', cursor: 'text', resize: 'vertical' }}
            placeholder="どう行動しますか？"
            value={playerInput}
            onChange={e => setPlayerInput(e.target.value)}
            disabled={isGenerating}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                handleNextScene();
              }
            }}
          />
          <button 
            className="btn btn-primary" 
            style={{ height: '48px', padding: '0 24px' }}
            onClick={() => handleNextScene()}
            disabled={isGenerating || !playerInput.trim()}
          >
            <Send size={18} style={{ marginRight: '8px' }}/> 行動する
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
          <button 
            className="btn btn-glass" 
            style={{ fontSize: '0.8rem', padding: '4px 12px' }}
            onClick={() => setIsSectionModalOpen(true)}
          >
            全セクションを閲覧する
          </button>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textAlign: 'right' }}>Ctrl+Enter で送信</div>
        </div>
      </div>
      
      {isSectionChecking && (
        <div style={{ position: 'absolute', top: '80px', right: '24px', background: 'rgba(0,0,0,0.8)', padding: '8px 16px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', zIndex: 50 }}>
          <div className="loading" style={{ width: '12px', height: '12px', borderWidth: '2px', margin: 0 }}></div>
          セクション判定中...
        </div>
      )}

      {/* セクション閲覧モーダル */}
      {isSectionModalOpen && (
        <div className="modal active">
          <div className="modal-content" style={{ maxWidth: '600px', width: '90%' }}>
            <button className="modal-close" onClick={() => setIsSectionModalOpen(false)}><X size={20} /></button>
            <h2 className="text-display" style={{ marginBottom: '16px' }}>セクション一覧</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '60vh', overflowY: 'auto' }}>
              {scenario.wizardData?.sections?.length > 0 ? (
                [...scenario.wizardData.sections]
                  .sort((a, b) => (a.number || 0) - (b.number || 0))
                  .map((s: any) => {
                    const cond = s.condition || decompressCondition(s.conditionZipped) || '不明な目標';
                    return (
                      <div key={s.number} className="glass-panel" style={{ padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: s.cleared ? '#4ade80' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {s.cleared ? <Check size={14} color="#000" /> : <span style={{ fontSize: '0.8rem' }}>{s.number}</span>}
                        </div>
                        <div style={{ flex: 1, color: s.cleared ? 'rgba(255,255,255,0.5)' : '#fff' }}>
                          {cond}
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div style={{ color: 'rgba(255,255,255,0.5)' }}>このシナリオには設定されたセクション（目標）がありません。</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* エンティティ（情報）閲覧モーダル */}
      {isEntitiesModalOpen && (
        <div className="modal active">
          <div className="modal-content" style={{ maxWidth: '700px', width: '95%' }}>
            <button className="modal-close" onClick={() => setIsEntitiesModalOpen(false)}><X size={20} /></button>
            <h2 className="text-display" style={{ marginBottom: '16px' }}>情報 (アイテム / 登場人物)</h2>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button className="btn btn-glass" onClick={handleExtractEntities} disabled={isExtracting}>
                {isExtracting ? '抽出中...' : 'シナリオから抽出(AI)'}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '60vh', overflowY: 'auto' }}>
              {entitiesList.length > 0 ? (
                entitiesList.map((ent: any) => (
                  <div key={ent.entityId} className="glass-panel" style={{ padding: '16px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                    {ent.imageData ? (
                      <img src={ent.imageData} alt={ent.name} style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: '100px', height: '100px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>No Image</div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{ent.name}</h3>
                        <span style={{ fontSize: '0.75rem', padding: '2px 6px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}>{ent.category === 'item' ? 'アイテム' : 'キャラクター'}</span>
                        {ent.acquired && <span style={{ fontSize: '0.75rem', padding: '2px 6px', background: 'rgba(74,222,128,0.2)', color: '#4ade80', borderRadius: '4px' }}>入手済</span>}
                      </div>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '0 0 16px 0', whiteSpace: 'pre-wrap' }}>{ent.description}</p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-glass" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={() => handleGenerateEntityImage(ent)}>画像生成</button>
                        <button className="btn btn-glass" style={{ padding: '4px 12px', fontSize: '0.8rem', color: '#f44336' }} onClick={() => handleDeleteEntity(ent.entityId)}>削除</button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: '32px 0' }}>アイテムや登場人物はまだ記録されていません。</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* カード取得モーダル */}
      {isGetCardModalOpen && (
        <div className="modal active" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '700px', width: '95%' }}>
            <button className="modal-close" onClick={() => setIsGetCardModalOpen(false)}><X size={20} /></button>
            <h2 className="text-display" style={{ marginBottom: '16px' }}>カードを取得する</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>シナリオに登場したキャラクターやアイテムを倉庫に持ち帰り、今後のパーティ編成で使うことができます。</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '60vh', overflowY: 'auto' }}>
              {entitiesList.length > 0 ? (
                entitiesList.map((ent: any) => (
                  <div key={ent.entityId} className="glass-panel" style={{ padding: '16px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                    {ent.imageData ? (
                      <img src={ent.imageData} alt={ent.name} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: '80px', height: '80px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>No Image</div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{ent.name}</h3>
                        <span style={{ fontSize: '0.75rem', padding: '2px 6px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}>{ent.category === 'item' ? 'アイテム' : 'キャラクター'}</span>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 12px 0' }}>{ent.description}</p>
                      <button className="btn btn-primary" style={{ padding: '6px 16px', fontSize: '0.9rem' }} onClick={() => handleSaveAsCard(ent)}>
                        取得する
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: '32px 0' }}>取得できるキャラクターやアイテムがありません。</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

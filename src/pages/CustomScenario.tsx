import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, CheckCircle, Image as ImageIcon } from 'lucide-react';
import { useUI } from '../contexts/UIContext';
import { 
  listAllParties, 
  loadCharacterData, 
  loadAvatarData, 
  createNewScenario, 
  getScenarioById, 
  updateScenario, 
  addSceneEntry 
} from '../lib/indexedDB';
import { StabilityApiClient } from '../lib/stabilityApiClient';
import { useLLM } from '../hooks/useLLM';
import pako from 'pako';

function zipString(str: string) {
  if (!str) return '';
  try {
    const utf8Bytes = new TextEncoder().encode(str);
    const compressed = pako.deflate(utf8Bytes);
    return btoa(String.fromCharCode.apply(null, Array.from(compressed)));
  } catch (e) {
    console.error('Error zipping string:', e);
    return '';
  }
}

interface Section {
  number: number;
  condition: string;
}

export default function CustomScenario() {
  const navigate = useNavigate();
  const { toast } = useUI();
  const [step, setStep] = useState(1);

  // Form State
  const [parties, setParties] = useState<any[]>([]);
  const [selectedPartyId, setSelectedPartyId] = useState<string | number>('');
  const [title, setTitle] = useState('');
  const [overview, setOverview] = useState('');
  const [sections, setSections] = useState<Section[]>([{ number: 1, condition: '' }]);
  const [intro, setIntro] = useState('');
  const [generateImageChecked, setGenerateImageChecked] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { generateResponse } = useLLM();

  useEffect(() => {
    const fetchParties = async () => {
      try {
        const allParties = await listAllParties();
        setParties(allParties);
      } catch (err) {
        toast('パーティ一覧の取得に失敗しました。', 'error');
      }
    };
    fetchParties();
  }, [toast]);

  const handleNext = () => setStep(s => s + 1);
  const handlePrev = () => setStep(s => s - 1);

  const handleAddSection = () => {
    setSections([...sections, { number: sections.length + 1, condition: '' }]);
  };

  const handleRemoveSection = (index: number) => {
    const newSec = [...sections];
    newSec.splice(index, 1);
    // Renumber
    newSec.forEach((s, idx) => { s.number = idx + 1; });
    setSections(newSec);
  };

  const handleSectionChange = (index: number, val: string) => {
    const newSec = [...sections];
    newSec[index].condition = val;
    setSections(newSec);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast('タイトルを入力してください。', 'error');
      return;
    }
    if (sections.length === 0 || sections.some(s => !s.condition.trim())) {
      toast('すべてのセクションの条件を入力してください。', 'error');
      return;
    }

    setIsSubmitting(true);
    toast('シナリオを作成しています...', 'info');

    try {
      // 1. Party Data
      let partyData: any[] = [];
      if (selectedPartyId === 'avatar') {
        const avatar = await loadAvatarData();
        if (avatar) {
          partyData = [{
            id: `avatar_${Date.now()}`,
            name: avatar.name || 'アバター',
            type: 'キャラクター',
            rarity: avatar.rarity || '★1',
            role: 'avatar',
            imageData: avatar.imageData || '',
            caption: avatar.serif || '',
            special: avatar.skill || ''
          }];
        }
      } else if (selectedPartyId !== '' && selectedPartyId !== 'none') {
        const pid = parseInt(selectedPartyId as string, 10);
        const allChars = await loadCharacterData();
        partyData = allChars.filter((c: any) => c.group === 'Party' && c.partyId === pid);
      }

      // 2. Wizard Data Format
      const wizardData = {
        partyId: selectedPartyId === 'avatar' ? -1 : (selectedPartyId === 'none' || selectedPartyId === '' ? 0 : parseInt(selectedPartyId as string, 10)),
        party: partyData,
        title,
        overview,
        intro,
        sections: sections.map(s => ({
          number: s.number,
          conditionZipped: zipString(s.condition),
          cleared: false
        }))
      };

      // 3. Create Scenario
      const scenarioId = await createNewScenario(wizardData, title);
      const scenarioObj = await getScenarioById(scenarioId as number);
      if (scenarioObj) {
        scenarioObj.wizardData = wizardData;
        await updateScenario(scenarioObj);
      }

      // 4. Intro Scene
      let sceneId = '';
      if (intro.trim()) {
        sceneId = `intro_${Date.now()}`;
        await addSceneEntry({
          scenarioId,
          type: 'scene',
          sceneId,
          content: intro,
          content_en: '',
          actionContent: '',
          actionContent_en: '',
          prompt: '',
        });
      }

      // 5. Generate Image (Asynchronous)
      if (intro.trim() && generateImageChecked && sceneId) {
        toast('導入シーンの画像生成をバックグラウンドで開始しました...', 'info');
        const apiKey = localStorage.getItem('stabilityApiKey');
        if (apiKey) {
          // Fire and forget
          generateResponse(`Translate to English for image generation prompt:\n${intro}`, [])
            .then(promptEn => {
              if (promptEn) {
                const client = new StabilityApiClient();
                return client.generateImage(promptEn, apiKey, { width: 1344, height: 768, style_preset: 'anime', samples: 1 })
                  .then(async imgRes => {
                    if (imgRes && imgRes[0]?.imageDataB64) {
                      await addSceneEntry({
                        scenarioId: scenarioId as number,
                        type: 'image',
                        sceneId,
                        dataUrl: 'data:image/png;base64,' + imgRes[0].imageDataB64,
                        prompt: promptEn
                      });
                      toast('導入シーンの画像生成が完了しました', 'success');
                    }
                  });
              }
            })
            .catch(e => {
              console.error('Image generation failed', e);
              toast('画像生成に失敗しました', 'error');
            });
        }
      }

      toast('カスタムシナリオを作成しました！', 'success');
      navigate('/');
    } catch (err: any) {
      console.error(err);
      toast(`シナリオ作成失敗: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button className="btn btn-glass" onClick={() => navigate('/')} title="メニューに戻る">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-display" style={{ fontSize: '2rem', marginBottom: '4px' }}>カスタムシナリオ作成</h1>
          <p className="text-secondary" style={{ fontSize: '0.9rem' }}>オリジナルのシナリオを手動で作成します。</p>
        </div>
      </header>

      <div className="glass-panel animate-fade-in" style={{ padding: '32px', flex: 1, overflowY: 'auto' }}>
        
        {/* STEP 1 */}
        {step === 1 && (
          <div className="animate-fade-in">
            <h2 className="text-display" style={{ marginBottom: '16px' }}>ステップ 1: パーティ選択</h2>
            <p style={{ marginBottom: '16px', color: 'rgba(255,255,255,0.7)' }}>このシナリオに挑戦するパーティを選んでください。</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', cursor: 'pointer' }}>
                <input type="radio" name="party" checked={selectedPartyId === 'none'} onChange={() => setSelectedPartyId('none')} />
                <span>パーティなし</span>
              </label>
              
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', cursor: 'pointer' }}>
                <input type="radio" name="party" checked={selectedPartyId === 'avatar'} onChange={() => setSelectedPartyId('avatar')} />
                <span>あなたの分身（アバター）</span>
              </label>

              {parties.map(p => (
                <label key={p.partyId} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', cursor: 'pointer' }}>
                  <input type="radio" name="party" checked={selectedPartyId === p.partyId} onChange={() => setSelectedPartyId(p.partyId)} />
                  <span>{p.name} <small style={{ color: '#aaa' }}>({p.updatedAt ? p.updatedAt.split('T')[0] : ''})</small></span>
                </label>
              ))}
            </div>

            <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={handleNext} disabled={selectedPartyId === ''}>
                次へ
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="animate-fade-in">
            <h2 className="text-display" style={{ marginBottom: '16px' }}>ステップ 2: シナリオ基本情報</h2>
            
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>タイトル <span style={{ color: '#f44336' }}>*</span></label>
              <input 
                type="text" 
                className="glass-input" 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                placeholder="シナリオのタイトル"
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>シナリオ概要</label>
              <textarea 
                className="glass-input" 
                value={overview} 
                onChange={e => setOverview(e.target.value)} 
                placeholder="シナリオのあらすじや目的など"
                rows={4}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'space-between' }}>
              <button className="btn btn-glass" onClick={handlePrev}>戻る</button>
              <button className="btn btn-primary" onClick={handleNext} disabled={!title.trim()}>次へ</button>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div className="animate-fade-in">
            <h2 className="text-display" style={{ marginBottom: '16px' }}>ステップ 3: セクション構成</h2>
            <p style={{ marginBottom: '16px', color: 'rgba(255,255,255,0.7)' }}>物語の進行を区切る「達成条件」を設定します。</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              {sections.map((sec, idx) => (
                <div key={idx} style={{ position: 'relative', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>セクション {sec.number}</label>
                  <textarea 
                    className="glass-input"
                    value={sec.condition}
                    onChange={e => handleSectionChange(idx, e.target.value)}
                    placeholder="例: 村人に話を聞き、森の入り口へ向かう。"
                    rows={2}
                    style={{ width: '100%' }}
                  />
                  {sections.length > 1 && (
                    <button 
                      onClick={() => handleRemoveSection(idx)}
                      style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#f44336', cursor: 'pointer' }}
                      title="削除"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button className="btn btn-glass" onClick={handleAddSection} style={{ marginBottom: '24px' }}>
              <Plus size={18} style={{ marginRight: '8px' }} /> セクションを追加
            </button>

            <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'space-between' }}>
              <button className="btn btn-glass" onClick={handlePrev}>戻る</button>
              <button className="btn btn-primary" onClick={handleNext} disabled={sections.some(s => !s.condition.trim())}>次へ</button>
            </div>
          </div>
        )}

        {/* STEP 4 */}
        {step === 4 && (
          <div className="animate-fade-in">
            <h2 className="text-display" style={{ marginBottom: '16px' }}>ステップ 4: 導入シーン</h2>
            
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>プロローグ・導入文 (任意)</label>
              <textarea 
                className="glass-input" 
                value={intro} 
                onChange={e => setIntro(e.target.value)} 
                placeholder="ゲーム開始直後に表示されるテキストです"
                rows={6}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={generateImageChecked} 
                  onChange={e => setGenerateImageChecked(e.target.checked)} 
                  style={{ width: '1.2rem', height: '1.2rem' }}
                />
                <span>
                  <ImageIcon size={18} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                  導入文から背景画像を自動生成する
                </span>
              </label>
            </div>

            <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'space-between' }}>
              <button className="btn btn-glass" onClick={handlePrev}>戻る</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? '作成中...' : <><CheckCircle size={18} style={{ marginRight: '8px' }} /> 作成完了</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

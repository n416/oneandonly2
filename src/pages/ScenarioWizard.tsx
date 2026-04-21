import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLLM, cleanStreamText, extractJsonObject } from '../hooks/useLLM';
import { createNewScenario, loadCharacterData } from '../lib/indexedDB';
import { getActiveDeckSlot, getDeck } from '../lib/deckManager';
import { BookOpen, Compass, Target, ArrowRight, ArrowLeft, Sparkles, Play } from 'lucide-react';
import { useUI } from '../contexts/UIContext';

export default function ScenarioWizard() {
  const navigate = useNavigate();
  const { generateResponse, isGenerating } = useLLM();
  const [streamText, setStreamText] = useState('');
  const { toast } = useUI();

  const [step, setStep] = useState(0);

  // Step 1 Data
  const [inputType, setInputType] = useState<'axis' | 'free'>('axis');
  const [stages] = useState(['ファンタジー', 'SF', '歴史', '現代', 'ホラー']);
  const [themes] = useState(['冒険', 'ミステリー', 'ロマンス', 'コメディ', 'スリラー']);
  const [moods] = useState(['明るい', '中間', 'ダーク']);
  
  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  const [selectedTheme, setSelectedTheme] = useState('');
  const [selectedMood, setSelectedMood] = useState('');
  const [freeInput, setFreeInput] = useState('');

  // Step 2 Data
  const [scenarioType, setScenarioType] = useState<'objective' | 'exploration' | null>(null);

  // Step 3 Data
  const [generatedScenario, setGeneratedScenario] = useState<any>(null);


  const getGenreString = () => {
    if (inputType === 'free') return freeInput || '指定なし';
    const st = selectedStages.length ? `【舞台】${selectedStages.join('/')}` : '';
    const th = selectedTheme ? `【テーマ】${selectedTheme}` : '';
    const md = selectedMood ? `【雰囲気】${selectedMood}` : '';
    return st + ' ' + th + ' ' + md;
  };

  const handleGenerateScenario = async () => {
    const genreStr = getGenreString();
    const typeStr = scenarioType === 'objective' ? '目的達成型' : '探索型';
    
    const prompt = `あなたは優秀なTRPGのゲームマスターです。
以下の条件に基づいて、新しいシナリオの設定を生成し、必ずJSON形式で出力してください。

【シナリオ条件】
- ジャンル: ${genreStr}
- タイプ: ${typeStr}

【JSONフォーマット要件】
以下のキーを持つ単一のJSONオブジェクトを出力してください。
{
  "title": "シナリオのタイトル（魅力的に）",
  "summary": "シナリオの全体的なあらすじ、背景設定（200文字程度）",
  "summaryEn": "シナリオ背景の英語翻訳（Stable Diffusionによる背景画像生成用のカンマ区切りのプロンプトキーワードとして最適化してください。例: dark fantasy, ruined castle, moonlight, high quality）",
  "clearCondition": "シナリオの最終クリア条件（※探索型の場合は空文字にしてください）",
  "sections": [
    {"number": 1, "condition": "クリア条件に至るまでの中間目標1"},
    {"number": 2, "condition": "中間目標2"}
  ],
  "introScene": "ゲーム開始時の導入シーンの描写（プレイヤーに状況を説明するゲームマスターの最初のセリフとして記述）"
}

出力は純粋なJSONのみとし、他のマークダウンやテキストは含めないでください。`;

    try {
      setStreamText('');
      const response = await generateResponse(prompt, [], undefined, (chunk) => {
        setStreamText(prev => prev + chunk);
      });
      const jsonStr = extractJsonObject(response);
      if (jsonStr) {
        const parsed = JSON.parse(jsonStr);
        setGeneratedScenario(parsed);
        setStep(2);
      } else {
        throw new Error("Invalid JSON format");
      }
    } catch (e: any) {
      console.error(e);
      toast("生成に失敗しました: " + e.message, "error");
    }
  };

  const handleStartScenario = async () => {
    if (!generatedScenario) return;

    try {
      const activeSlot = getActiveDeckSlot();
      const deckIds = getDeck(activeSlot);
      const allData = await loadCharacterData();
      const partyCards = allData.filter((c: any) => deckIds.includes(c.id));

      const scenarioData = {
        title: generatedScenario.title,
        genre: getGenreString(),
        scenarioType,
        clearCondition: generatedScenario.clearCondition,
        scenarioSummary: generatedScenario.summary,
        scenarioSummaryEn: generatedScenario.summaryEn,
        introScene: generatedScenario.introScene,
        sections: generatedScenario.sections,
        party: partyCards,
      };

      await createNewScenario(scenarioData, generatedScenario.title);
      toast('シナリオを作成しました！', 'success');
      // 本来はチャット画面(scenario.html相当)へ遷移する
      navigate(`/bookshelf`);
    } catch (e: any) {
      console.error(e);
      toast('保存に失敗しました: ' + e.message, 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 className="text-display" style={{ fontSize: '2rem', marginBottom: '8px' }}>シナリオ作成ウィザード</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ 
              height: '4px', 
              flex: 1, 
              background: i <= step ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
              borderRadius: '2px',
              transition: 'background 0.3s'
            }} />
          ))}
        </div>
      </header>

      <div className="glass-panel" style={{ flex: 1, padding: '32px', display: 'flex', flexDirection: 'column' }}>
        
        {/* Step 0: Genre */}
        {step === 0 && (
          <div className="animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h2 className="text-display" style={{ fontSize: '1.5rem', marginBottom: '16px' }}>ステップ 1：ジャンルを選択</h2>
            
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
              <button className={`btn ${inputType === 'axis' ? 'btn-primary' : 'btn-glass'}`} onClick={() => setInputType('axis')}>軸から選択</button>
              <button className={`btn ${inputType === 'free' ? 'btn-primary' : 'btn-glass'}`} onClick={() => setInputType('free')}>自由入力</button>
            </div>

            {inputType === 'axis' ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>
                <div>
                  <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>舞台（複数選択可）</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {stages.map(s => (
                      <button key={s} className={`btn ${selectedStages.includes(s) ? 'btn-primary' : 'btn-glass'}`} onClick={() => setSelectedStages(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>テーマ（単一選択）</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {themes.map(t => (
                      <button key={t} className={`btn ${selectedTheme === t ? 'btn-primary' : 'btn-glass'}`} onClick={() => setSelectedTheme(t === selectedTheme ? '' : t)}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>雰囲気（単一選択）</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {moods.map(m => (
                      <button key={m} className={`btn ${selectedMood === m ? 'btn-primary' : 'btn-glass'}`} onClick={() => setSelectedMood(m === selectedMood ? '' : m)}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1 }}>
                <textarea 
                  className="btn-glass"
                  style={{ width: '100%', height: '150px', padding: '16px', textAlign: 'left', cursor: 'text' }}
                  placeholder="例：クトゥルフ神話、学園異能バトル など自由に記述してください"
                  value={freeInput}
                  onChange={e => setFreeInput(e.target.value)}
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button className="btn btn-primary" onClick={() => setStep(1)}>
                次へ <ArrowRight size={18} style={{ marginLeft: '8px' }}/>
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Scenario Type */}
        {step === 1 && (
          <div className="animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h2 className="text-display" style={{ fontSize: '1.5rem', marginBottom: '16px' }}>ステップ 2：シナリオタイプを選択</h2>
            
            <div style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', marginBottom: '24px' }}>
              <p><strong>ジャンル:</strong> {getGenreString() || '未設定'}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', flex: 1 }}>
              <div 
                className={`glass-panel ${scenarioType === 'objective' ? 'border-primary' : ''}`}
                style={{ padding: '24px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px' }}
                onClick={() => setScenarioType('objective')}
              >
                <div style={{ background: scenarioType === 'objective' ? 'var(--primary)' : 'rgba(255,255,255,0.1)', padding: '16px', borderRadius: '50%' }}>
                  <Target size={32} />
                </div>
                <h3 className="text-display">目的達成型</h3>
                <p className="text-secondary" style={{ fontSize: '0.9rem' }}>魔王の討伐やアイテムの獲得など、明確なクリア条件が設定される王道スタイル。</p>
              </div>

              <div 
                className={`glass-panel ${scenarioType === 'exploration' ? 'border-primary' : ''}`}
                style={{ padding: '24px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px' }}
                onClick={() => setScenarioType('exploration')}
              >
                <div style={{ background: scenarioType === 'exploration' ? 'var(--primary)' : 'rgba(255,255,255,0.1)', padding: '16px', borderRadius: '50%' }}>
                  <Compass size={32} />
                </div>
                <h3 className="text-display">探索型</h3>
                <p className="text-secondary" style={{ fontSize: '0.9rem' }}>自由な探索と発見が中心。ゴールが明確に定まっていないオープンワールド的スタイル。</p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
              <button className="btn btn-glass" onClick={() => setStep(0)} disabled={isGenerating}>
                <ArrowLeft size={18} style={{ marginRight: '8px' }}/> 戻る
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleGenerateScenario}
                disabled={!scenarioType || isGenerating}
              >
                {isGenerating ? 'AI生成中...' : 'シナリオ生成開始'} 
                {!isGenerating && <BookOpen size={18} style={{ marginLeft: '8px' }}/>}
              </button>
            </div>
            
            {/* ストリーミングプレビュー領域 */}
            {isGenerating && streamText && (
              <div className="animate-fade-in" style={{ 
                marginTop: '24px', 
                background: 'rgba(15, 17, 26, 0.9)', 
                border: '1px solid rgba(74, 222, 128, 0.3)', 
                borderRadius: '8px', 
                padding: '16px',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, #4ade80, transparent)', animation: 'scanline 2s linear infinite' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#4ade80' }}>
                  <Sparkles size={16} className="pulse-animation" />
                  <span style={{ fontSize: '0.8rem', letterSpacing: '2px' }}>AI IS BUILDING THE SCENARIO...</span>
                </div>
                <div style={{ 
                  fontFamily: '"Courier New", Courier, monospace', 
                  fontSize: '0.9rem', 
                  color: '#a7f3d0', 
                  lineHeight: '1.6',
                  maxHeight: '150px',
                  overflowY: 'auto',
                  textShadow: '0 0 5px rgba(167, 243, 208, 0.5)'
                }}>
                  {cleanStreamText(streamText)}
                  <span className="blink-cursor">_</span>
                </div>
              </div>
            )}
            
            <style>{`
              @keyframes scanline {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
              }
              .blink-cursor {
                animation: blink 1s step-end infinite;
              }
              @keyframes blink {
                0%, 100% { opacity: 1; }
                50% { opacity: 0; }
              }
            `}</style>
          </div>
        )}

        {/* Step 2: Confirmation */}
        {step === 2 && generatedScenario && (
          <div className="animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <h2 className="text-display" style={{ fontSize: '1.5rem', marginBottom: '8px' }}>ステップ 3：シナリオ確認</h2>
            <p className="text-secondary" style={{ marginBottom: '24px' }}>以下の内容でシナリオを開始します。</p>

            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '24px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 className="text-gradient" style={{ fontSize: '1.5rem', marginBottom: '8px' }}>{generatedScenario.title}</h3>
              </div>
              
              <div>
                <strong style={{ color: 'var(--primary-light)' }}>概要</strong>
                <p style={{ marginTop: '4px', lineHeight: 1.6 }}>{generatedScenario.summary}</p>
              </div>

              {generatedScenario.clearCondition && (
                <div>
                  <strong style={{ color: 'var(--primary-light)' }}>最終クリア条件</strong>
                  <p style={{ marginTop: '4px', background: 'rgba(236, 72, 153, 0.1)', padding: '8px', borderRadius: '4px', color: '#ec4899' }}>
                    {generatedScenario.clearCondition}
                  </p>
                </div>
              )}

              {generatedScenario.sections && generatedScenario.sections.length > 0 && (
                <div>
                  <strong style={{ color: 'var(--primary-light)' }}>中間目標 (セクション)</strong>
                  <ul style={{ marginTop: '8px', paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {generatedScenario.sections.map((s: any) => (
                      <li key={s.number}>第{s.number}章: {s.condition}</li>
                    ))}
                  </ul>
                </div>
              )}

              <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)' }} />

              <div>
                <strong style={{ color: 'var(--primary-light)' }}>導入シーン</strong>
                <p style={{ marginTop: '8px', lineHeight: 1.6, fontStyle: 'italic', background: 'rgba(0,0,0,0.4)', padding: '16px', borderRadius: '8px', borderLeft: '4px solid var(--primary)' }}>
                  「{generatedScenario.introScene}」
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
              <button className="btn btn-glass" onClick={() => setStep(1)}>
                <ArrowLeft size={18} style={{ marginRight: '8px' }}/> 作り直す
              </button>
              <button className="btn btn-primary" onClick={handleStartScenario} style={{ padding: '12px 32px' }}>
                <Play size={18} style={{ marginRight: '8px' }}/> このシナリオで始める
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

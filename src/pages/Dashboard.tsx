import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, Users, Archive, BookOpen, Library, Settings, Play } from 'lucide-react';
import { useState, useEffect } from 'react';
import { listAllScenarios } from '../lib/indexedDB';

export default function Dashboard() {
  const navigate = useNavigate();
  const [ongoingScenarios, setOngoingScenarios] = useState<any[]>([]);

  useEffect(() => {
    async function loadScenarios() {
      try {
        const all = await listAllScenarios();
        // 進行中のもの（isCleared が false や 未定義 のもの）を抽出
        const ongoing = all.filter(s => !s.isCleared);
        // 更新日時降順
        ongoing.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setOngoingScenarios(ongoing);
      } catch (e) {
        console.error("シナリオ取得失敗", e);
      }
    }
    loadScenarios();
  }, []);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '800px', margin: '0 auto', paddingBottom: '40px' }}>
      
      <h1 className="text-display text-gradient" style={{ fontSize: '3rem', letterSpacing: '-0.03rem', marginBottom: '70px', marginTop: '80px', textAlign: 'center' }}>
        one and only
        <div style={{ fontSize: '0.8rem', fontFamily: 'serif', color: 'var(--text-secondary)' }}>
          <span style={{ letterSpacing: '0.75rem', whiteSpace: 'nowrap' }}>ー 選択の先に ー</span>
        </div>
      </h1>

      <div className="api-key-section" style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '10px', width: '100%' }}>
        <Link to="/settings" id="set-api-key-button" data-tutorial="target-apisections" className="btn btn-glass" style={{ padding: '8px 16px' }}>
          <Settings size={16} /> APIキー・設定
        </Link>
      </div>

      <div className="element-section" style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '40px', width: '100%' }}>
        <Link to="/avatar" id="you-avatar-btn" data-tutorial="target-avatar" className="btn btn-glass" style={{ minWidth: '150px' }}>
          <UserPlus size={18} />
          あなたの分身
        </Link>
      </div>

      <div className="element-section" style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '10px', marginTop: '20px', width: '100%' }}>
        <Link to="/character" id="character-create" data-tutorial="target-generate" className="btn btn-glass">
          <UserPlus size={18} />
          生成
        </Link>
        <Link to="/warehouse" id="show-warehouse-btn" data-tutorial="target-warehouse" className="btn btn-glass">
          <Archive size={18} />
          倉庫・デッキ
        </Link>
      </div>

      <div className="scenario-wizard-section" style={{ display: 'flex', justifyContent: 'center', marginTop: '50px', width: '100%' }}>
        <Link 
          to="/scenario" 
          id="start-new-scenario-button" 
          data-tutorial="target-scenario"
          className="btn btn-primary" 
          style={{ fontSize: '1.2rem', padding: '16px 40px', width: '100%', maxWidth: '400px', boxShadow: '0 0 20px rgba(99, 102, 241, 0.5)' }}
        >
          新しいシナリオを始める
        </Link>
      </div>

      <div className="scenario-wizard-section" style={{ display: 'flex', justifyContent: 'center', marginTop: '20px', width: '100%' }}>
        <Link to="/custom-scenario" id="start-custom-scenario-button" data-tutorial="target-custom-scenario" className="btn btn-glass" style={{ minWidth: '200px' }}>
          <BookOpen size={18} />
          執筆
        </Link>
      </div>

      <div className="element-section" style={{ display: 'flex', justifyContent: 'center', marginTop: '40px', width: '100%' }}>
        <Link to="/bookshelf" id="show-bookshelf-btn" data-tutorial="target-bookshelf" className="btn btn-glass" style={{ minWidth: '200px' }}>
          <Library size={18} />
          本棚
        </Link>
      </div>

      <div className="accordion glass-panel" style={{ width: '100%', maxWidth: '600px', marginTop: '50px', padding: '16px', borderRadius: '12px' }}>
        <div className="accordion-header" id="ongoing-scenarios-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 'bold' }}>進行中のシナリオ一覧</div>
        </div>
        <div className="accordion-content" id="ongoing-scenarios-content" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
          {ongoingScenarios.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {ongoingScenarios.map(sc => (
                <div key={sc.scenarioId} className="glass-panel hover-glow" style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => navigate('/play/' + sc.scenarioId)}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', margin: '0 0 4px 0' }}>{sc.title}</h3>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      最終更新: {new Date(sc.updatedAt).toLocaleString()}
                    </div>
                  </div>
                  <Play size={20} color="var(--primary)" />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              進行中のシナリオはありません。
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, LayoutDashboard, Users, Archive, UserPlus, BookOpen, Settings, Save, ImageIcon, Library, Volume2, VolumeX } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import SaveLoadModal from '../SaveLoadModal';
import BgImageModal from '../BgImageModal';
import { getBgImageById } from '../../lib/indexedDB';

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSaveLoadModalOpen, setIsSaveLoadModalOpen] = useState(false);
  const [isBgModalOpen, setIsBgModalOpen] = useState(false);
  const [globalBgUrl, setGlobalBgUrl] = useState<string | null>(null);
  const [isBgmStopped, setIsBgmStopped] = useState(localStorage.getItem('bgmStopped') === 'true');

  // /play/:scenarioId にいる場合はそのIDを取得する
  const playMatch = location.pathname.match(/^\/play\/(\d+)$/);
  const currentPlayScenarioId = playMatch ? Number(playMatch[1]) : undefined;

  useEffect(() => {
    const loadBg = async () => {
      const savedId = localStorage.getItem('globalBgId');
      if (savedId && savedId !== 'none') {
        try {
          const img = await getBgImageById(Number(savedId));
          if (img && img.dataUrl) {
            setGlobalBgUrl(img.dataUrl);
            return;
          }
        } catch (e) {
          console.error(e);
        }
      }
      setGlobalBgUrl(null);
    };
    loadBg();
  }, []);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const handleInteraction = () => {
      if (!isBgmStopped && audioRef.current && audioRef.current.paused) {
        audioRef.current.volume = 0;
        audioRef.current.play().then(() => {
          let vol = 0;
          const interval = setInterval(() => {
            if (vol < 0.5 && audioRef.current) {
              vol = Math.min(0.5, vol + 0.05);
              audioRef.current.volume = vol;
            } else {
              clearInterval(interval);
            }
          }, 200);
        }).catch(() => { /* BGMファイルが無いか自動再生がブロックされた場合は無視 */ });
      }
    };
    
    document.addEventListener('click', handleInteraction, { once: true });
    
    const handleBgmToggleEvent = () => {
      // 外部イベント用(必要なら)
      const stopped = localStorage.getItem('bgmStopped') === 'true';
      setIsBgmStopped(stopped);
      if (audioRef.current) {
        if (stopped) {
          audioRef.current.pause();
        } else {
          audioRef.current.volume = 0.5;
          audioRef.current.play().catch(e => console.error(e));
        }
      }
    };
    window.addEventListener('bgm-toggle', handleBgmToggleEvent);

    return () => {
      document.removeEventListener('click', handleInteraction);
      window.removeEventListener('bgm-toggle', handleBgmToggleEvent);
    };
  }, [isBgmStopped]);

  const toggleBgm = () => {
    const newState = !isBgmStopped;
    setIsBgmStopped(newState);
    localStorage.setItem('bgmStopped', newState.toString());
    if (audioRef.current) {
      if (newState) {
        audioRef.current.pause();
      } else {
        audioRef.current.volume = 0.5;
        audioRef.current.play().catch(() => {});
      }
    }
  };

  const handleSelectBg = (dataUrl: string | null, id: number | null) => {
    setGlobalBgUrl(dataUrl);
    if (id !== null) {
      localStorage.setItem('globalBgId', id.toString());
    } else {
      localStorage.setItem('globalBgId', 'none');
    }
    setIsBgModalOpen(false);
  };

  const navItems = [
    { path: '/', label: 'ホーム', icon: LayoutDashboard },
    { path: '/party', label: 'パーティ', icon: Users },
    { path: '/warehouse', label: '倉庫', icon: Archive },
    { path: '/character', label: 'キャラ作成', icon: UserPlus },
    { path: '/avatar', label: 'アバター', icon: UserPlus },
    { path: '/scenario', label: 'シナリオ', icon: BookOpen },
    { path: '/custom-scenario', label: 'カスタム', icon: BookOpen },
    { path: '/bookshelf', label: '本棚', icon: Library },
    { path: '/settings', label: '設定', icon: Settings },
  ];

  return (
    <div className="app-container" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh', 
      overflow: 'hidden',
      backgroundImage: globalBgUrl ? `url(${globalBgUrl})` : 'none',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed'
    }}>
      {globalBgUrl && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 0 }}></div>
      )}
      
      <audio ref={audioRef} id="bgm" src="/main-back.mp3" loop preload="auto" />
      
      {/* Original Application Bar */}
      <header className="glass-panel" style={{ 
        margin: '16px', 
        padding: '12px 24px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        zIndex: 50
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button id="open-tutorial-list-button" onClick={() => navigate('/tutorial')} data-tutorial="target-tutorial" className="btn btn-glass" style={{ padding: '8px 16px' }}>
            <BookOpen size={18} />
            <span className="hidden-mobile" style={{ marginLeft: '4px' }}>取説</span>
          </button>
          {location.pathname.startsWith('/play') && (
            <button id="save-load-button" onClick={() => setIsSaveLoadModalOpen(true)} data-tutorial="target-saveload" className="btn btn-glass" style={{ padding: '8px 16px' }}>
              <Save size={18} />
              <span className="hidden-mobile" style={{ marginLeft: '4px' }}>続き</span>
            </button>
          )}
          <button id="change-bg-button" onClick={() => setIsBgModalOpen(true)} data-tutorial="target-bg" className="btn btn-glass" style={{ padding: '8px 16px' }}>
            <ImageIcon size={18} />
            <span className="hidden-mobile" style={{ marginLeft: '4px' }}>背景</span>
          </button>
          <button onClick={toggleBgm} className="btn btn-glass" style={{ padding: '8px 16px' }} title={isBgmStopped ? 'BGMを再生' : 'BGMを停止'}>
            {isBgmStopped ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>

        <button 
          id="hamburger-button" 
          className="btn btn-glass" 
          style={{ padding: '8px' }}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Hamburger Menu Overlay */}
      {isMenuOpen && (
        <div style={{
          position: 'absolute', top: '70px', right: '16px', zIndex: 40,
          background: 'var(--bg-surface)', backdropFilter: 'blur(12px)',
          border: '1px solid var(--border-color)', borderRadius: '12px',
          padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px',
          boxShadow: 'var(--shadow-lg)'
        }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link 
                key={item.path}
                to={item.path} 
                onClick={() => setIsMenuOpen(false)}
                className={`btn ${isActive ? 'btn-primary' : 'btn-glass'}`}
                style={{ minWidth: '150px' }}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}

      {/* Main Content Area */}
      <main style={{ 
        flex: 1, 
        padding: '0 16px 16px 16px', 
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div className="glass-panel animate-fade-in" style={{ 
          flex: 1, 
          padding: '32px', 
          display: 'flex', 
          flexDirection: 'column',
          position: 'relative'
        }}>
          <Outlet />
        </div>
      </main>

      <SaveLoadModal 
        isOpen={isSaveLoadModalOpen}
        onClose={() => setIsSaveLoadModalOpen(false)}
        currentScenarioId={currentPlayScenarioId}
        onLoadSuccess={(sid) => {
          navigate(`/play/${sid}`);
        }}
      />

      <BgImageModal
        isOpen={isBgModalOpen}
        onClose={() => setIsBgModalOpen(false)}
        onSelectBg={handleSelectBg}
      />
    </div>
  );
}

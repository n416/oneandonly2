import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, BookOpen, CheckCircle, PlayCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { tutorialGroups, tutorials, Tutorial } from '../data/tutorialData';
import { useTutorial } from '../lib/TutorialContext';

export default function TutorialList() {
  const navigate = useNavigate();
  const { startTutorial } = useTutorial();
  const [completedTutorials, setCompletedTutorials] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 完了フラグをローカルストレージから読み込む
    const loadCompleted = () => {
      const completed = new Set<string>();
      tutorials.forEach(t => {
        if (localStorage.getItem(`tutorial_completed_${t.id}`) === 'true') {
          completed.add(t.id);
        }
      });
      setCompletedTutorials(completed);
    };
    loadCompleted();
  }, []);

  const handleStartTutorial = (tutorial: Tutorial) => {
    startTutorial(tutorial.id);
  };

  const scrollToTab = (index: number) => {
    setActiveTab(index);
    if (trackRef.current) {
      const cell = trackRef.current.children[0]?.children[index] as HTMLElement;
      if (cell) {
        trackRef.current.scrollTo({ left: cell.offsetLeft, behavior: 'smooth' });
      }
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollLeft = target.scrollLeft;
    const width = target.clientWidth;
    if (width > 0) {
      const newIndex = Math.round(scrollLeft / width);
      if (newIndex !== activeTab && newIndex >= 0 && newIndex < tutorialGroups.length) {
        setActiveTab(newIndex);
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: '1000px', margin: '0 auto' }}>
      <header style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button className="btn btn-glass" onClick={() => navigate('/')} title="メニューに戻る">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-display" style={{ fontSize: '2rem', marginBottom: '4px' }}>チュートリアル</h1>
          <p className="text-secondary" style={{ fontSize: '0.9rem' }}>アプリの基本的な操作方法や遊び方を学びます。</p>
        </div>
      </header>

      <div className="carousel-wrapper">
        <div className="carousel-tabs-scrollable" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {tutorialGroups.map((group, i) => (
              <button 
                key={group.id} 
                className={`carousel-tab ${activeTab === i ? 'active' : ''}`}
                onClick={() => scrollToTab(i)}
              >
                {group.name}
              </button>
            ))}
          </div>
        </div>

        <div className="carousel-viewport" ref={trackRef} onScroll={handleScroll}>
          <div className="carousel-track">
            {tutorialGroups.map(group => {
              const groupTutorials = tutorials.filter(t => t.groupId === group.id);
              return (
                <div key={group.id} className="carousel-cell" style={{ padding: '4px', gap: '16px' }}>
                  {groupTutorials.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px', color: 'rgba(255,255,255,0.3)' }}>
                      チュートリアルがありません
                    </div>
                  ) : (
                    groupTutorials.map(tut => {
                      const isDone = completedTutorials.has(tut.id);
                      return (
                        <div key={tut.id} className="glass-panel" style={{ 
                          padding: '16px 24px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          borderLeft: isDone ? '4px solid #4CAF50' : '4px solid rgba(255,255,255,0.2)'
                        }}>
                          <div>
                            <h3 style={{ margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <BookOpen size={18} style={{ color: 'rgba(255,255,255,0.5)' }} />
                              {tut.title}
                              {isDone && <CheckCircle size={16} style={{ color: '#4CAF50' }} aria-label="完了済み" />}
                            </h3>
                            <p className="text-secondary" style={{ margin: 0, fontSize: '0.9rem' }}>
                              {tut.description}
                            </p>
                          </div>
                          <button className="btn btn-primary" onClick={() => handleStartTutorial(tut)}>
                            <PlayCircle size={18} style={{ marginRight: '8px' }} /> 
                            {isDone ? 'もう一度見る' : '開始する'}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

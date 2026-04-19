import { useEffect, useState } from 'react';
import { useTutorial } from '../lib/TutorialContext';

export default function TutorialOverlay() {
  const { activeTutorial, currentSubStep, nextStep, endTutorial } = useTutorial();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!activeTutorial || !currentSubStep) {
      setTargetRect(null);
      return;
    }

    const updateRect = () => {
      if (currentSubStep.highlightSelector) {
        const el = document.querySelector(currentSubStep.highlightSelector);
        if (el) {
          setTargetRect(el.getBoundingClientRect());
        } else {
          setTargetRect(null);
        }
      } else {
        setTargetRect(null);
      }
    };

    updateRect();
    
    // ウィンドウリサイズ時にも再計算
    window.addEventListener('resize', updateRect);
    // DOMの変更を監視 (非同期でレンダリングされる要素用)
    const observer = new MutationObserver(updateRect);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener('resize', updateRect);
      observer.disconnect();
    };
  }, [activeTutorial, currentSubStep]);

  useEffect(() => {
    // クリック待ち機能
    if (activeTutorial && currentSubStep && currentSubStep.waitForClickOn) {
      const el = document.querySelector(currentSubStep.waitForClickOn);
      if (el) {
        const handleClick = () => {
          nextStep();
        };
        el.addEventListener('click', handleClick);
        return () => el.removeEventListener('click', handleClick);
      }
    }
  }, [activeTutorial, currentSubStep, nextStep, targetRect]); // targetRectが更新されたら再バインド

  if (!activeTutorial || !currentSubStep) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none' }}>
      
      {/* ハイライト用のマスク（くり抜き） */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        clipPath: targetRect ? `polygon(
          0% 0%, 0% 100%, 
          ${targetRect.left - 5}px 100%, 
          ${targetRect.left - 5}px ${targetRect.top - 5}px, 
          ${targetRect.right + 5}px ${targetRect.top - 5}px, 
          ${targetRect.right + 5}px ${targetRect.bottom + 5}px, 
          ${targetRect.left - 5}px ${targetRect.bottom + 5}px, 
          ${targetRect.left - 5}px 100%, 
          100% 100%, 100% 0%
        )` : 'none',
        transition: 'clip-path 0.3s ease',
        pointerEvents: currentSubStep.waitForClickOn ? 'none' : 'auto'
      }}></div>

      {/* ダイアログ */}
      <div 
        className="glass-panel"
        style={{
          position: 'absolute',
          top: targetRect ? Math.min(targetRect.bottom + 20, window.innerHeight - 200) : '50%',
          left: '50%',
          transform: targetRect ? 'translateX(-50%)' : 'translate(-50%, -50%)',
          width: '300px',
          padding: '20px',
          pointerEvents: 'auto',
          backgroundColor: 'var(--bg-base)',
          border: '2px solid var(--primary)',
          boxShadow: '0 0 30px rgba(99,102,241,0.6)'
        }}
      >
        <p style={{ marginBottom: '16px', fontWeight: 'bold' }}>{currentSubStep.message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button className="btn btn-glass" onClick={endTutorial} style={{ padding: '4px 8px', fontSize: '0.8rem' }}>
            終了
          </button>
          {!currentSubStep.removeOkButton && !currentSubStep.complete && (
            <button className="btn btn-primary" onClick={nextStep} style={{ padding: '4px 12px' }}>
              次へ
            </button>
          )}
          {currentSubStep.complete && (
            <button className="btn btn-primary" onClick={endTutorial} style={{ padding: '4px 12px' }}>
              完了
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

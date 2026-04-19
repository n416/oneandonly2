import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ConfirmState {
  isOpen: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isAlert: boolean;
}

interface UIContextType {
  toast: (message: string, type?: ToastType) => void;
  confirm: (message: string) => Promise<boolean>;
  alert: (message: string) => Promise<void>;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

let toastIdCounter = 0;

export const UIProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
    isAlert: false,
  });

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++toastIdCounter;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const confirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        message,
        isAlert: false,
        onConfirm: () => {
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
          resolve(true);
        },
        onCancel: () => {
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
          resolve(false);
        },
      });
    });
  }, []);

  const alert = useCallback((message: string): Promise<void> => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        message,
        isAlert: true,
        onConfirm: () => {
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
          resolve();
        },
        onCancel: () => {
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
          resolve();
        },
      });
    });
  }, []);

  return (
    <UIContext.Provider value={{ toast, confirm, alert }}>
      {children}
      
      {/* Toast Render */}
      <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {toasts.map((t) => (
          <div key={t.id} className="glass-panel animate-fade-in" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px', minWidth: '250px', background: 'rgba(20,20,30,0.95)', borderLeft: `4px solid ${t.type === 'error' ? '#f44336' : t.type === 'success' ? '#4caf50' : '#2196f3'}` }}>
            {t.type === 'error' && <AlertCircle size={18} color="#f44336" />}
            {t.type === 'success' && <CheckCircle size={18} color="#4caf50" />}
            {t.type === 'info' && <Info size={18} color="#2196f3" />}
            <span style={{ fontSize: '0.9rem', color: '#fff' }}>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Confirm/Alert Modal Render */}
      {confirmState.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div className="glass-panel animate-fade-in" style={{ width: '90%', maxWidth: '400px', padding: '24px', position: 'relative' }}>
            <p style={{ fontSize: '1.1rem', marginBottom: '24px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{confirmState.message}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              {!confirmState.isAlert && (
                <button className="btn btn-glass" onClick={confirmState.onCancel}>キャンセル</button>
              )}
              <button className="btn btn-primary" onClick={confirmState.onConfirm}>OK</button>
            </div>
          </div>
        </div>
      )}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};

import React, { useState, createContext, useContext, useCallback } from 'react';
import { X, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastContextType {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const value = {
    success: (message: string) => addToast('success', message),
    error: (message: string) => addToast('error', message),
    info: (message: string) => addToast('info', message),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg animate-slide-up ${
              toast.type === 'success' ? 'bg-green-500/90' :
              toast.type === 'error' ? 'bg-red-500/90' :
              'bg-cyan-500/90'
            }`}
          >
            {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-white" />}
            {toast.type === 'error' && <XCircle className="w-5 h-5 text-white" />}
            {toast.type === 'info' && <AlertCircle className="w-5 h-5 text-white" />}
            <span className="text-white font-medium">{toast.message}</span>
            <button onClick={() => removeToast(toast.id)} className="ml-2 text-white/70 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

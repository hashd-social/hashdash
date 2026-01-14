import React from 'react';
import { ToastProvider } from './components/Toast';
import { ByteCaveProvider } from './contexts/ByteCaveContext';
import { Dashboard } from './components/Dashboard';
import './index.css';

function App() {
  return (
    <ToastProvider>
      <ByteCaveProvider>
        <Dashboard />
      </ByteCaveProvider>
    </ToastProvider>
  );
}

export default App;

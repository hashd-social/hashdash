import React from 'react';
import { ToastProvider } from './components/Toast';
import { Dashboard } from './components/Dashboard';
import './index.css';

function App() {
  return (
    <ToastProvider>
      <Dashboard />
    </ToastProvider>
  );
}

export default App;

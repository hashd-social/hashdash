import React from 'react';
import { ToastProvider } from './components/Toast';
import { ByteCaveProvider } from '@hashd/bytecave-browser';
import { Dashboard } from './components/Dashboard';
import './index.css';

function App() {
  const vaultRegistry = process.env.REACT_APP_VAULT_REGISTRY || '';
  const contentRegistry = process.env.REACT_APP_CONTENT_REGISTRY || '';
  const rpcUrl = process.env.REACT_APP_RPC_URL || 'http://localhost:8545';
  const relayPeersEnv = process.env.REACT_APP_RELAY_PEERS || '';
  const relayPeers = relayPeersEnv ? relayPeersEnv.split(',').map(p => p.trim()).filter(Boolean) : [];

  return (
    <ToastProvider>
      <ByteCaveProvider
        contractAddress={vaultRegistry}
        contentRegistryAddress={contentRegistry}
        rpcUrl={rpcUrl}
        appId="hashd"
        relayPeers={relayPeers}
      >
        <Dashboard />
      </ByteCaveProvider>
    </ToastProvider>
  );
}

export default App;

import React from 'react';
import { ToastProvider } from './components/Toast';
import { ByteCaveProvider } from '@gethashd/bytecave-browser';
import { Dashboard } from './components/Dashboard';
import './index.css';

function App() {
  const vaultRegistry = process.env.REACT_APP_VAULT_REGISTRY || '';
  const contentRegistry = process.env.REACT_APP_CONTENT_REGISTRY || '';
  const rpcUrl = process.env.REACT_APP_RPC_URL || 'http://localhost:8545';
  const relayPeersEnv = process.env.REACT_APP_RELAY_PEERS || '';
  const relayPeers = relayPeersEnv ? relayPeersEnv.split(',').map(p => p.trim()).filter(Boolean) : [];
  const relayHttpUrl = process.env.REACT_APP_RELAY_HTTP_URL || '';

  console.log('[App] ByteCave Config:', {
    vaultRegistry,
    relayPeers,
    relayHttpUrl,
    hasRelayHttpUrl: !!relayHttpUrl
  });

  return (
    <ToastProvider>
      <ByteCaveProvider
        vaultNodeRegistryAddress={vaultRegistry}
        contentRegistryAddress={contentRegistry}
        rpcUrl={rpcUrl}
        appId="hashd"
        relayPeers={relayPeers}
        relayHttpUrl={relayHttpUrl}
      >
        <Dashboard />
      </ByteCaveProvider>
    </ToastProvider>
  );
}

export default App;

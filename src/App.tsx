import React, { useState, useEffect } from 'react';
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
  const relayWsUrl = process.env.REACT_APP_RELAY_WS_URL || 'ws://localhost:4003';
  
  // Load directNodeAddrs from localStorage for relay fallback
  const [directNodeAddrs, setDirectNodeAddrs] = useState<string[] | null>(null);
  
  useEffect(() => {
    try {
      const stored = localStorage.getItem('bytecave_peers');
      if (stored) {
        const config = JSON.parse(stored);
        if (config.directNodeAddrs && Array.isArray(config.directNodeAddrs)) {
          console.log('[App] Loaded directNodeAddrs from localStorage:', config.directNodeAddrs.length);
          setDirectNodeAddrs(config.directNodeAddrs);
          return;
        }
      }
    } catch (error) {
      console.error('[App] Failed to load directNodeAddrs from localStorage:', error);
    }
    // Set to empty array if nothing found
    setDirectNodeAddrs([]);
  }, []);

  // Wait for localStorage to load before rendering provider
  if (directNodeAddrs === null) {
    return <div>Loading...</div>;
  }

  console.log('[App] ByteCave Config:', {
    vaultRegistry,
    relayPeers,
    relayHttpUrl,
    relayWsUrl,
    directNodeAddrs: directNodeAddrs.length,
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
        relayWsUrl={relayWsUrl}
        directNodeAddrs={directNodeAddrs}
      >
        <Dashboard />
      </ByteCaveProvider>
    </ToastProvider>
  );
}

export default App;

/**
 * Peer Configuration Manager
 * 
 * Manages persistent peer addresses in peers.json file.
 * Falls back to .env if peers.json doesn't exist.
 */

export interface PeerConfig {
  directNodeAddrs: string[];
  relayPeers: string[];
  lastUpdated: string;
}

const PEERS_CONFIG_PATH = '/peers.json'; // Relative to public folder

/**
 * Load peer configuration from peers.json or .env
 */
export async function loadPeerConfig(): Promise<PeerConfig> {
  try {
    // Try to load from peers.json first
    const response = await fetch(PEERS_CONFIG_PATH);
    if (response.ok) {
      const config = await response.json();
      console.log('[PeerConfig] Loaded from peers.json:', config);
      return config;
    }
  } catch (error) {
    console.log('[PeerConfig] peers.json not found, using .env');
  }

  // Fallback to .env
  const directNodeAddrsEnv = process.env.REACT_APP_DIRECT_NODE_ADDRS || '';
  const directNodeAddrs = directNodeAddrsEnv 
    ? directNodeAddrsEnv.split(',').map(p => p.trim()).filter(p => p)
    : [];
  
  const relayPeersEnv = process.env.REACT_APP_RELAY_PEERS || '';
  const relayPeers = relayPeersEnv 
    ? relayPeersEnv.split(',').map(p => p.trim()).filter(p => p)
    : [];

  const config: PeerConfig = {
    directNodeAddrs,
    relayPeers,
    lastUpdated: new Date().toISOString()
  };

  console.log('[PeerConfig] Created from .env:', config);

  // Save to peers.json for future use
  await savePeerConfig(config);

  return config;
}

/**
 * Save peer configuration to peers.json
 */
export async function savePeerConfig(config: PeerConfig): Promise<void> {
  try {
    config.lastUpdated = new Date().toISOString();
    
    // Save to localStorage as a workaround since we can't write to public folder from browser
    localStorage.setItem('bytecave_peers', JSON.stringify(config));
    console.log('[PeerConfig] Saved to localStorage:', config);
  } catch (error) {
    console.error('[PeerConfig] Failed to save:', error);
  }
}

/**
 * Update peer configuration with newly discovered peers
 */
export async function updatePeerConfig(
  newDirectAddrs: string[] = [],
  newRelayPeers: string[] = []
): Promise<void> {
  const currentConfig = await loadPeerConfigFromStorage();
  
  // Merge with existing, avoiding duplicates
  const directNodeAddrs = Array.from(new Set([
    ...currentConfig.directNodeAddrs,
    ...newDirectAddrs
  ]));
  
  const relayPeers = Array.from(new Set([
    ...currentConfig.relayPeers,
    ...newRelayPeers
  ]));

  const updatedConfig: PeerConfig = {
    directNodeAddrs,
    relayPeers,
    lastUpdated: new Date().toISOString()
  };

  await savePeerConfig(updatedConfig);
  console.log('[PeerConfig] Updated with new peers:', updatedConfig);
}

/**
 * Load from localStorage (internal helper)
 */
async function loadPeerConfigFromStorage(): Promise<PeerConfig> {
  try {
    const stored = localStorage.getItem('bytecave_peers');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('[PeerConfig] Failed to load from localStorage:', error);
  }

  // Return empty config if nothing stored
  return {
    directNodeAddrs: [],
    relayPeers: [],
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Clear peer configuration (forces reload from .env on next start)
 */
export function clearPeerConfig(): void {
  localStorage.removeItem('bytecave_peers');
  console.log('[PeerConfig] Cleared peer configuration');
}

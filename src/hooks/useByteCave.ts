/**
 * React hook for ByteCave P2P client
 * 
 * Provides WebRTC-based P2P connectivity to ByteCave storage nodes
 */

import { useState, useEffect, useCallback } from 'react';
import { ByteCaveClient, ContractDiscovery } from '@hashd/bytecave-browser';
import type { PeerInfo, ConnectionState, StoreResult, RetrieveResult } from '@hashd/bytecave-browser';

const VAULT_REGISTRY_ADDRESS = process.env.REACT_APP_VAULT_REGISTRY || '';
const RPC_URL = process.env.REACT_APP_RPC_URL || 'http://localhost:8545';

// Singleton client instance to prevent multiple instances across hot reloads
// IMPORTANT: This is initialized in the useEffect with relay peers, not here
let globalClient: ByteCaveClient | null = null;

interface NodeInfo {
  publicKey: string;
  ownerAddress?: string;
  peerId: string;
}

interface NodeHealth {
  status: string;
  blobCount: number;
  storageUsed: number;
  uptime: number;
}

interface UseByteCaveReturn {
  client: ByteCaveClient | null;
  connectionState: ConnectionState;
  peers: PeerInfo[];
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  store: (data: Uint8Array, contentType?: string) => Promise<StoreResult>;
  retrieve: (cid: string) => Promise<RetrieveResult>;
  getNodeInfo: (peerId: string) => Promise<NodeInfo | null>;
  getNodeHealth: (peerId: string) => Promise<NodeHealth | null>;
  error: string | null;
}

export function useByteCave(): UseByteCaveReturn {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Use singleton client instance
    console.log('[useByteCave] Initializing, globalClient exists:', !!globalClient);
    
    if (!VAULT_REGISTRY_ADDRESS) {
      console.warn('[useByteCave] REACT_APP_VAULT_REGISTRY not set, ByteCave P2P disabled');
      return;
    }

    // Get relay peers from environment
    const relayPeersEnv = process.env.REACT_APP_RELAY_PEERS || '';
    console.log('[useByteCave] REACT_APP_RELAY_PEERS env var:', relayPeersEnv);
    const relayPeers = relayPeersEnv 
      ? relayPeersEnv.split(',').map(p => p.trim()).filter(p => p)
      : [];
    
    console.log('[useByteCave] Parsed relay peers:', relayPeers);

    // Always recreate client to ensure relay peers are used
    if (globalClient) {
      console.log('[useByteCave] Stopping old ByteCaveClient to recreate with relay peers');
      globalClient.stop().catch(err => console.error('Error stopping old client:', err));
      globalClient = null;
    }
    
    console.log('[useByteCave] Creating NEW ByteCaveClient with relay peers:', relayPeers);
    
    if (relayPeers.length === 0) {
      console.warn('[useByteCave] No relay peers configured! Set REACT_APP_RELAY_PEERS in .env');
    }
    
    globalClient = new ByteCaveClient({
      contractAddress: VAULT_REGISTRY_ADDRESS,
      rpcUrl: RPC_URL,
      relayPeers,
      maxPeers: 10,
      connectionTimeout: 30000
    });

    const client = globalClient;

    // Set up event listeners
    const handleStateChange = (state: ConnectionState) => setConnectionState(state);
    const handlePeerUpdate = async () => {
      const peers = await client.getPeers();
      console.log('[useByteCave] handlePeerUpdate - peers:', peers.length, peers.map(p => p.peerId.slice(0, 12)));
      setPeers(peers);
    };

    client.on('connectionStateChange', handleStateChange);
    client.on('peerAnnounce', handlePeerUpdate);
    client.on('peerConnect', handlePeerUpdate);
    client.on('peerDisconnect', handlePeerUpdate);

    // Sync initial state
    setConnectionState(client.getConnectionState());
    (async () => {
      const peers = await client.getPeers();
      setPeers(peers);
    })();

    return () => {
      client.off('connectionStateChange', handleStateChange);
      client.off('peerAnnounce', handlePeerUpdate);
      client.off('peerConnect', handlePeerUpdate);
      client.off('peerDisconnect', handlePeerUpdate);
      // Don't stop the client on unmount - it's a singleton
    };
  }, []);

  const connect = useCallback(async () => {
    console.log('[useByteCave] connect() called, globalClient:', !!globalClient);
    if (!globalClient) {
      setError('ByteCave client not initialized');
      console.error('[useByteCave] Client not initialized!');
      return;
    }

    try {
      setError(null);
      await globalClient.start();
      // Update peers after connections complete - start() returns before dials finish
      const updatePeers = async () => {
        if (globalClient) {
          const peers = await globalClient.getPeers();
          console.log('[useByteCave] Updating peers:', peers.length);
          setPeers(peers);
        }
      };
      updatePeers();
      setTimeout(updatePeers, 500);
      setTimeout(updatePeers, 1500);
      setTimeout(updatePeers, 3000);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (!globalClient) return;

    try {
      await globalClient.stop();
      setPeers([]);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const store = useCallback(async (data: Uint8Array, contentType?: string): Promise<StoreResult> => {
    if (!globalClient) {
      return { success: false, error: 'Client not initialized' };
    }
    return globalClient.store(data, contentType);
  }, []);

  const retrieve = useCallback(async (cid: string): Promise<RetrieveResult> => {
    if (!globalClient) {
      return { success: false, error: 'Client not initialized' };
    }
    return globalClient.retrieve(cid);
  }, []);

  const getNodeInfo = useCallback(async (peerId: string): Promise<NodeInfo | null> => {
    if (!globalClient) {
      return null;
    }
    // Cast to any since TypeScript doesn't have the updated type declarations
    return (globalClient as any).getNodeInfo(peerId);
  }, []);

  const getNodeHealth = useCallback(async (peerId: string): Promise<NodeHealth | null> => {
    if (!globalClient) {
      return null;
    }
    // Cast to any since TypeScript doesn't have the updated type declarations
    return (globalClient as any).getNodeHealth(peerId);
  }, []);

  return {
    client: globalClient,
    connectionState,
    peers,
    isConnected: connectionState === 'connected',
    connect,
    disconnect,
    store,
    retrieve,
    getNodeInfo,
    getNodeHealth,
    error
  };
}

/**
 * Hook for contract-based node discovery only (no P2P)
 */
export function useNodeDiscovery() {
  const [nodes, setNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNodes = useCallback(async () => {
    if (!VAULT_REGISTRY_ADDRESS) {
      setError('REACT_APP_VAULT_REGISTRY not set');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const discovery = new ContractDiscovery(VAULT_REGISTRY_ADDRESS, RPC_URL);
      const activeNodes = await discovery.getActiveNodes();
      setNodes(activeNodes);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  return { nodes, loading, error, refetch: fetchNodes };
}

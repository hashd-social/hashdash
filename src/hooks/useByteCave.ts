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
let globalClient: ByteCaveClient | null = null;

interface UseByteCaveReturn {
  client: ByteCaveClient | null;
  connectionState: ConnectionState;
  peers: PeerInfo[];
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  store: (data: Uint8Array, contentType?: string) => Promise<StoreResult>;
  retrieve: (cid: string) => Promise<RetrieveResult>;
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

    // Only create client if it doesn't exist
    if (!globalClient) {
      console.log('[useByteCave] Creating NEW ByteCaveClient singleton');
      globalClient = new ByteCaveClient({
        contractAddress: VAULT_REGISTRY_ADDRESS,
        rpcUrl: RPC_URL,
        seedNodes: [
          'http://localhost:5001',
          'http://localhost:5002', 
          'http://localhost:5003'
        ],
        maxPeers: 10,
        connectionTimeout: 30000
      });
    } else {
      console.log('[useByteCave] Reusing existing ByteCaveClient singleton');
    }

    const client = globalClient;

    // Set up event listeners
    const handleStateChange = (state: ConnectionState) => setConnectionState(state);
    const handlePeerUpdate = () => {
      const peers = client.getPeers();
      console.log('[useByteCave] handlePeerUpdate - peers:', peers.length, peers.map(p => p.peerId.slice(0, 12)));
      setPeers(peers);
    };

    client.on('connectionStateChange', handleStateChange);
    client.on('peerAnnounce', handlePeerUpdate);
    client.on('peerConnect', handlePeerUpdate);
    client.on('peerDisconnect', handlePeerUpdate);

    // Sync initial state
    setConnectionState(client.getConnectionState());
    setPeers(client.getPeers());

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
      const updatePeers = () => {
        if (globalClient) {
          const peers = globalClient.getPeers();
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

  return {
    client: globalClient,
    connectionState,
    peers,
    isConnected: connectionState === 'connected',
    connect,
    disconnect,
    store,
    retrieve,
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

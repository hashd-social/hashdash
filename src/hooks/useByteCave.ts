/**
 * React hook for ByteCave P2P client
 * 
 * Provides WebRTC-based P2P connectivity to ByteCave storage nodes
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ByteCaveClient, ContractDiscovery } from '@hashd/bytecave-browser';
import type { ByteCaveConfig, PeerInfo, ConnectionState, StoreResult, RetrieveResult } from '@hashd/bytecave-browser';
import { loadPeerConfig, updatePeerConfig } from '../utils/peerConfig';

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
  nodeId?: string;
  publicKey?: string;
  ownerAddress?: string;
  metrics?: {
    requestsLastHour: number;
    avgResponseTime: number;
    successRate: number;
  };
  integrity?: {
    checked: number;
    passed: number;
    failed: number;
    orphaned: number;
    metadataTampered: number;
    failedCids: string[];
  };
}

interface UseByteCaveReturn {
  client: ByteCaveClient | null;
  connectionState: ConnectionState;
  peers: PeerInfo[];
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  store: (data: Uint8Array, contentType?: string, signer?: any) => Promise<StoreResult>;
  retrieve: (cid: string) => Promise<RetrieveResult>;
  getNodeInfo: (peerId: string) => Promise<NodeInfo | null>;
  getNodeHealth: (peerId: string) => Promise<NodeHealth | null>;
  error: string | null;
}

export function useByteCave(): UseByteCaveReturn {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const connectCalledRef = useRef(false);

  const connect = useCallback(async () => {
    if (!globalClient) {
      setError('ByteCave client not initialized - please wait');
      return;
    }

    try {
      // Only start if not already connected
      const currentState = globalClient.getConnectionState();
    
      if (currentState !== 'connected') {
        await globalClient.start();
      }
      
      const actualState = globalClient.getConnectionState();
      const peers = await globalClient.getPeers();
      
      setConnectionState(actualState);
      setPeers(peers);
    } catch (err: any) {
      setError(err.message);
      setConnectionState('error');
    }
  }, []);

  useEffect(() => {
    if (!VAULT_REGISTRY_ADDRESS) {
      return;
    }

    const initializeClient = async () => {
      const peerConfig = await loadPeerConfig();

      if (globalClient) {
        await globalClient.stop().catch(() => {});
        globalClient = null;
      }
      
      globalClient = new ByteCaveClient({
        contractAddress: VAULT_REGISTRY_ADDRESS,
        rpcUrl: RPC_URL,
        directNodeAddrs: peerConfig.directNodeAddrs,
        relayPeers: peerConfig.relayPeers,
        maxPeers: 10,
        connectionTimeout: 30000
      } as ByteCaveConfig);

      const client = globalClient;

      const handleStateChange = (state: ConnectionState) => {
        setConnectionState(state);
      };
      
      const handlePeerUpdate = async () => {
        if (!client) return;
        try {
          const peers = await client.getPeers();
          setPeers(peers);
          
          const connectedAddrs = peers
            .filter(p => p.connected)
            .map(p => `/ip4/127.0.0.1/tcp/5022/ws/p2p/${p.peerId}`);
          
          if (connectedAddrs.length > 0) {
            await updatePeerConfig(connectedAddrs, []);
          }
        } catch (err) {
          // Silent
        }
      };

      client.on('connectionStateChange', handleStateChange);
      client.on('peerConnect', handlePeerUpdate);
      client.on('peerDisconnect', handlePeerUpdate);

      const hasPeers = peerConfig.directNodeAddrs.length > 0 || peerConfig.relayPeers.length > 0;
      
      if (hasPeers && !connectCalledRef.current) {
        connectCalledRef.current = true;
        setTimeout(() => {
          connect();
        }, 100);
      }

      // Periodically refresh peer list to discover new nodes from relay
      // Only run when client is connected to avoid clearing peer list
      const peerRefreshInterval = setInterval(() => {
        if (connectionState === 'connected') {
          handlePeerUpdate();
        }
      }, 5000); // Check every 5 seconds

      return () => {
        clearInterval(peerRefreshInterval);
      };
    };

    initializeClient();

    return () => {
      if (globalClient) {
        globalClient.off('connectionStateChange', () => {});
        globalClient.off('peerConnect', () => {});
        globalClient.off('peerDisconnect', () => {});
      }
    };
  }, []);

  const disconnect = async () => {
    if (!globalClient) return;

    try {
      await globalClient.stop();
      setPeers([]);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getPeers = async (): Promise<PeerInfo[]> => {
    if (!globalClient) {
      return [];
    }
    return globalClient.getPeers();
  };

  const store = async (data: Uint8Array, contentType?: string, signer?: any): Promise<StoreResult> => {
    if (!globalClient) {
      return { success: false, error: 'Client not initialized' };
    }
    return (globalClient as any).store(data, contentType, signer);
  };

  const retrieve = async (cid: string): Promise<RetrieveResult> => {
    if (!globalClient) {
      return { success: false, error: 'Client not initialized' };
    }
    return globalClient.retrieve(cid);
  };

  const getNodeInfo = async (peerId: string): Promise<NodeInfo | null> => {
    if (!globalClient) {
      return null;
    }
    return (globalClient as any).getNodeInfo(peerId);
  };

  const getNodeHealth = async (peerId: string): Promise<NodeHealth | null> => {
    if (!globalClient) {
      return null;
    }
    return (globalClient as any).getNodeHealth(peerId);
  };

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
// Force TS reload

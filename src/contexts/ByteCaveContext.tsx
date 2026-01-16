import React, { createContext, useContext, ReactNode, useState, useEffect, useRef, useCallback } from 'react';
import { ByteCaveClient } from '@hashd/bytecave-browser';
import type { ByteCaveConfig, PeerInfo, ConnectionState, StoreResult, RetrieveResult } from '@hashd/bytecave-browser';

interface NodeHealth {
  status: string;
  blobCount: number;
  storageUsed: number;
  uptime: number;
  nodeId?: string;
  publicKey?: string;
  secp256k1PublicKey?: string;
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

interface ByteCaveContextValue {
  connectionState: ConnectionState;
  peers: PeerInfo[];
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  store: (data: Uint8Array, contentType?: string, signer?: any) => Promise<StoreResult>;
  retrieve: (cid: string) => Promise<RetrieveResult>;
  getNodeHealth: (peerId: string) => Promise<NodeHealth | null>;
  error: string | null;
}

const ByteCaveContext = createContext<ByteCaveContextValue | null>(null);

interface ByteCaveProviderProps {
  children: ReactNode;
  contractAddress?: string;
  rpcUrl?: string;
  relayPeers?: string[];
}

let globalClient: ByteCaveClient | null = null;

export function ByteCaveProvider({ children, contractAddress, rpcUrl, relayPeers }: ByteCaveProviderProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const connectCalledRef = useRef(false);

  const connect = useCallback(async () => {
    if (!globalClient) {
      setError('ByteCave client not initialized');
      return;
    }

    try {
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
    const vaultRegistry = contractAddress || process.env.REACT_APP_VAULT_REGISTRY || '';
    const rpc = rpcUrl || process.env.REACT_APP_RPC_URL || 'http://localhost:8545';
    const relayPeersEnv = process.env.REACT_APP_RELAY_PEERS || '';
    const relays = relayPeers || (relayPeersEnv ? relayPeersEnv.split(',').map(p => p.trim()).filter(Boolean) : []);

    if (!vaultRegistry) {
      console.warn('[ByteCaveProvider] No vault registry address provided');
      return;
    }

    console.log('[ByteCaveProvider] Initializing with config:', {
      contractAddress: vaultRegistry,
      rpcUrl: rpc,
      relayPeers: relays
    });

    const initializeClient = async () => {
      // Don't reinitialize if client already exists
      if (globalClient) {
        console.log('[ByteCaveProvider] Client already exists, skipping initialization');
        return;
      }
      
      console.log('[ByteCaveProvider] Creating new ByteCaveClient');
      globalClient = new ByteCaveClient({
        contractAddress: vaultRegistry,
        rpcUrl: rpc,
        directNodeAddrs: [],
        relayPeers: relays,
        maxPeers: 10,
        connectionTimeout: 30000
      } as ByteCaveConfig);

      const client = globalClient;

      const handleStateChange = (state: ConnectionState) => {
        console.log('[ByteCaveProvider] State changed:', state);
        setConnectionState(state);
      };
      
      const handlePeerUpdate = async () => {
        if (!client) return;
        try {
          const peers = await client.getPeers();
          console.log('[ByteCaveProvider] Peers updated:', peers.length);
          setPeers(peers);
        } catch (err) {
          console.warn('[ByteCaveProvider] Failed to get peers:', err);
        }
      };

      client.on('connectionStateChange', handleStateChange);
      client.on('peerConnect', handlePeerUpdate);
      client.on('peerDisconnect', handlePeerUpdate);

      const hasPeers = relays.length > 0;
      
      if (hasPeers && !connectCalledRef.current) {
        connectCalledRef.current = true;
        console.log('[ByteCaveProvider] Auto-connecting in 100ms');
        setTimeout(() => {
          connect();
        }, 100);
      }
    };

    initializeClient();

    return () => {
      console.log('[ByteCaveProvider] Cleanup - removing event listeners');
      if (globalClient) {
        globalClient.off('connectionStateChange', () => {});
        globalClient.off('peerConnect', () => {});
        globalClient.off('peerDisconnect', () => {});
      }
    };
  }, []); // Empty deps - only initialize once

  const disconnect = async () => {
    if (!globalClient) return;
    try {
      await globalClient.stop();
      setPeers([]);
    } catch (err: any) {
      setError(err.message);
    }
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

  const getNodeHealth = async (peerId: string): Promise<NodeHealth | null> => {
    if (!globalClient) {
      return null;
    }
    return (globalClient as any).getNodeHealth(peerId);
  };

  const value: ByteCaveContextValue = {
    connectionState,
    peers,
    isConnected: connectionState === 'connected',
    connect,
    disconnect,
    store,
    retrieve,
    getNodeHealth,
    error
  };

  return (
    <ByteCaveContext.Provider value={value}>
      {children}
    </ByteCaveContext.Provider>
  );
}

export function useByteCaveContext() {
  const context = useContext(ByteCaveContext);
  if (!context) {
    throw new Error('useByteCaveContext must be used within ByteCaveProvider');
  }
  return context;
}

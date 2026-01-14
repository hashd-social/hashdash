import React, { createContext, useContext, ReactNode } from 'react';
import { useByteCave } from '../hooks/useByteCave';
import type { PeerInfo, ConnectionState, StoreResult, RetrieveResult } from '@hashd/bytecave-browser';

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

export function ByteCaveProvider({ children }: { children: ReactNode }) {
  const bytecave = useByteCave();

  return (
    <ByteCaveContext.Provider value={bytecave}>
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

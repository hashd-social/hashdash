declare module '@hashd/bytecave-browser' {
  export interface ByteCaveConfig {
    vaultNodeRegistryAddress?: string;
    contentRegistryAddress?: string;
    rpcUrl?: string;
    appId: string;
    relayPeers?: string[]; // Relay node multiaddrs for pure P2P discovery
    directNodeAddrs?: string[];
    maxPeers?: number;
    connectionTimeout?: number;
  }

  export interface PeerInfo {
    peerId: string;
    publicKey: string;
    contentTypes: string[] | 'all';
    connected: boolean;
    latency?: number;
  }

  export interface StoreResult {
    success: boolean;
    cid?: string;
    peerId?: string;
    error?: string;
  }

  export interface RetrieveResult {
    success: boolean;
    data?: Uint8Array;
    peerId?: string;
    error?: string;
  }

  export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

  export class ByteCaveClient {
    constructor(config: ByteCaveConfig);
    start(): Promise<void>;
    stop(): Promise<void>;
    store(data: Uint8Array, contentType?: string): Promise<StoreResult>;
    retrieve(cid: string): Promise<RetrieveResult>;
    getPeers(): Promise<PeerInfo[]>;
    getConnectionState(): ConnectionState;
    on(event: string, callback: Function): void;
    off(event: string, callback: Function): void;
  }

  export class ContractDiscovery {
    constructor(vaultNodeRegistryAddress: string, rpcUrl: string);
    getActiveNodes(): Promise<any[]>;
    getNodeCount(): Promise<{ total: number; active: number }>;
  }
}

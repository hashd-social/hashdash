declare module '@hashd/bytecave-browser' {
  export interface ByteCaveConfig {
    contractAddress: string;
    rpcUrl: string;
    bootstrapWebSocket?: string;
    seedNodes?: string[];
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
    getPeers(): PeerInfo[];
    getConnectionState(): ConnectionState;
    on(event: string, callback: Function): void;
    off(event: string, callback: Function): void;
  }

  export class ContractDiscovery {
    constructor(contractAddress: string, rpcUrl: string);
    getActiveNodes(): Promise<any[]>;
    getNodeCount(): Promise<{ total: number; active: number }>;
  }
}

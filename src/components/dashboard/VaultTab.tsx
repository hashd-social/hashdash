import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { CryptoUtils } from '../../utils/crypto';
import { useByteCave } from '../../hooks/useByteCave';
import { 
  Database, 
  RefreshCw, 
  Server, 
  CheckCircle,
  AlertCircle,
  Plus,
  Wifi,
  WifiOff
} from 'lucide-react';

// Interfaces
interface NodeInfo {
  nodeId: string;
  owner: string;
  publicKey: string;
  url: string;
  metadataHash: string;
  registeredAt: number;
  active: boolean;
}

interface NodeHealth {
  status: string;
  storedBlobs: number;
  totalSize: number;
  uptime: number;
  successRate: number;
  peers: number;
  requestsLastHour: number;
  avgResponseTime: number;
  peerId?: string;
  nodeId?: string;
  isRelay?: boolean;
  integrity?: {
    checked: number;
    passed: number;
    failed: number;
    orphaned: number;
    metadataTampered: number;
    failedCids: string[];
  };
  contentTypes?: string[] | 'all';
  allowedGuilds?: string[] | 'all';
  blockedGuilds?: string[];
}

interface NodeWithHealth extends NodeInfo {
  health?: NodeHealth;
  loading?: boolean;
  isRegistered?: boolean;
}

interface NetworkStats {
  totalNodes: number;
  activeNodes: number;
  totalBlobs: number;
  totalSize: number;
  avgSuccessRate: number;
  healthyNodes: number;
}

interface ReplicationStats {
  totalBlobs: number;
  completeReplications: number;
  incompleteReplications: number;
  avgReplicationFactor: number;
}

const VAULT_REGISTRY_ADDRESS = process.env.REACT_APP_VAULT_REGISTRY;
const HASHD_TOKEN_ADDRESS = process.env.REACT_APP_HASHD_TOKEN;

// ABI for VaultNodeRegistry
const VAULT_REGISTRY_ABI = [
  'function registerNode(bytes _publicKey, string _url, bytes32 _metadataHash, uint256 _stakeAmount) external returns (bytes32)',
  'function removeNode(bytes32 _nodeId) external',
  'function updateNode(bytes32 _nodeId, string _url, bytes32 _metadataHash) external',
  'function reactivateNode(bytes32 _nodeId) external',
  'function getActiveNodes() external view returns (bytes32[])',
  'function getAllNodes(uint256 _offset, uint256 _limit) external view returns (bytes32[])',
  'function getNode(bytes32 _nodeId) external view returns (tuple(address owner, bytes publicKey, string url, bytes32 metadataHash, uint256 registeredAt, bool active))',
  'function getNodeCount() external view returns (uint256 total, uint256 active)'
];

// ERC20 ABI for HASHD token
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)'
];

export const VaultTab: React.FC = () => {
  // P2P WebRTC client
  const { 
    connectionState: p2pState, 
    peers: p2pPeers, 
    isConnected: p2pConnected,
    connect: connectP2P,
    disconnect: disconnectP2P,
    store: p2pStore,
    getNodeInfo,
    getNodeHealth,
    error: p2pError 
  } = useByteCave();

  // Network stats
  const [networkStats, setNetworkStats] = useState<NetworkStats | null>(null);
  const [replicationStats, setReplicationStats] = useState<ReplicationStats | null>(null);
  
  // Nodes
  const [nodes, setNodes] = useState<NodeWithHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingNode, setEditingNode] = useState<NodeInfo | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    ownerAddress: '',
    publicKey: '',
    url: '',
    metadata: ''
  });

  // Test storage state
  const [testText, setTestText] = useState('');
  const [storageResult, setStorageResult] = useState<{ cid?: string; error?: string } | null>(null);
  const [storing, setStoring] = useState(false);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [p2pPeers]);


  async function fetchData() {
    try {
      if (!VAULT_REGISTRY_ADDRESS) {
        console.error('REACT_APP_VAULT_REGISTRY not configured');
        setLoading(false);
        return;
      }

      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const contract = new ethers.Contract(VAULT_REGISTRY_ADDRESS, VAULT_REGISTRY_ABI, provider);

      // Get node counts
      const [total, active] = await contract.getNodeCount();
      const totalNodes = Number(total);
      const activeNodes = Number(active);

      // Get all nodes (including deactivated) for display - only if there are nodes
      let nodeIds: string[] = [];
      if (totalNodes > 0) {
        nodeIds = await contract.getAllNodes(0, 100);
      }
      
      // Fetch details for each node
      const nodeDetails: NodeWithHealth[] = await Promise.all(
        nodeIds.map(async (nodeId: string) => {
          const node = await contract.getNode(nodeId);
          return {
            nodeId,
            owner: node[0],
            publicKey: ethers.hexlify(node[1]),
            url: node[2],
            metadataHash: node[3],
            registeredAt: Number(node[4]),
            active: node[5],
            loading: true
          };
        })
      );

      setNodes(nodeDetails);

      // Fetch health stats for each active node via P2P ONLY
      // No HTTP fallback - nodes must be reachable via P2P
      const healthPromises = nodeDetails.map(async (node) => {
        // Skip health check for inactive nodes
        if (!node.active) return null;
        
        // Try to get health via P2P for all connected peers
        if (p2pConnected && p2pPeers.length > 0) {
          // Try each connected peer to find one that matches this node
          for (const peer of p2pPeers) {
            try {
              console.log(`[VaultTab] Trying P2P health for peer ${peer.peerId.slice(0, 12)}...`);
              const p2pHealth = await getNodeHealth(peer.peerId);
              if (p2pHealth) {
                console.log(`[VaultTab] Got P2P health from ${peer.peerId.slice(0, 12)}:`, p2pHealth);
                return {
                  status: p2pHealth.status,
                  storedBlobs: p2pHealth.blobCount || 0,
                  totalSize: p2pHealth.storageUsed || 0,
                  uptime: p2pHealth.uptime || 0,
                  successRate: p2pHealth.metrics?.successRate || 1,
                  peers: 0,
                  requestsLastHour: p2pHealth.metrics?.requestsLastHour || 0,
                  avgResponseTime: p2pHealth.metrics?.avgResponseTime || 0,
                  peerId: peer.peerId,
                  nodeId: p2pHealth.nodeId,
                  integrity: p2pHealth.integrity
                };
              }
            } catch (err) {
              console.warn(`[VaultTab] P2P health failed for ${peer.peerId.slice(0, 12)}`);
            }
          }
        }

        // No P2P available - return null (node unreachable)
        console.log(`[VaultTab] No P2P connection available for node ${node.nodeId.slice(0, 12)}`);
        return null;
      });

      const healthStats = await Promise.all(healthPromises);

      // Update registered nodes with health
      const registeredNodesWithHealth = nodeDetails.map((node, i) => ({
        ...node,
        loading: false,
        health: healthStats[i] || undefined,
        isRegistered: true
      }));

      // Add P2P discovered peers that aren't registered
      const registeredPeerIds = new Set(registeredNodesWithHealth.map(n => n.nodeId));
      
      // Extract relay peer ID from env to skip it - relay doesn't have ByteCave health protocol
      const relayPeerId = process.env.REACT_APP_RELAY_PEERS?.split('/p2p/')[1];
      
      const unregisteredP2PPeers: NodeWithHealth[] = await Promise.all(
        p2pPeers
          .filter(peer => !registeredPeerIds.has(peer.peerId))
          .filter(peer => peer.peerId !== relayPeerId) // Skip relay - it doesn't have health protocol
          .map(async (peer) => {
            let health = undefined;
            
            // Get health via P2P only - no HTTP fallback
            if (p2pConnected) {
              try {
                console.log(`[VaultTab] Getting P2P health for peer ${peer.peerId.slice(0, 12)}`);
                const p2pHealth = await getNodeHealth(peer.peerId);
                if (p2pHealth) {
                  health = {
                    status: p2pHealth.status,
                    storedBlobs: p2pHealth.blobCount || 0,
                    totalSize: p2pHealth.storageUsed || 0,
                    uptime: p2pHealth.uptime || 0,
                    successRate: p2pHealth.metrics?.successRate || 1,
                    peers: 0,
                    requestsLastHour: p2pHealth.metrics?.requestsLastHour || 0,
                    avgResponseTime: p2pHealth.metrics?.avgResponseTime || 0,
                    peerId: peer.peerId,
                    nodeId: p2pHealth.nodeId,
                    integrity: p2pHealth.integrity
                  };
                  console.log(`[VaultTab] Got P2P health from ${peer.peerId.slice(0, 12)}:`, p2pHealth);
                }
              } catch (err) {
                console.warn(`[VaultTab] P2P health failed for ${peer.peerId.slice(0, 12)}:`, err);
              }
            }

            return {
              nodeId: peer.peerId,
              owner: '',
              publicKey: '',
              url: `p2p://${peer.peerId}`,
              metadataHash: '',
              registeredAt: 0,
              active: peer.connected,
              loading: false,
              health,
              isRegistered: false
            };
          })
      );

      // Combine registered and unregistered peers
      setNodes([...registeredNodesWithHealth, ...unregisteredP2PPeers]);

      // Aggregate network stats
      const validHealth = healthStats.filter((h): h is NonNullable<typeof h> => h !== null);
      const totalBlobs = validHealth.reduce((sum, h) => sum + h.storedBlobs, 0);
      const totalSize = validHealth.reduce((sum, h) => sum + h.totalSize, 0);
      const healthyNodes = validHealth.filter(h => h.status === 'healthy').length;
      const avgSuccessRate = validHealth.length > 0
        ? validHealth.reduce((sum, h) => sum + h.successRate, 0) / validHealth.length
        : 0;

      setNetworkStats({
        totalNodes,
        activeNodes,
        totalBlobs,
        totalSize,
        avgSuccessRate,
        healthyNodes
      });

      // Replication stats would need a P2P protocol - skip for now
      // TODO: Add /bytecave/replication-stats protocol

    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddNode(e: React.FormEvent) {
    e.preventDefault();
    
    try {
      if (!VAULT_REGISTRY_ADDRESS) {
        alert('Registry address not configured');
        return;
      }

      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(VAULT_REGISTRY_ADDRESS, VAULT_REGISTRY_ABI, signer);

      const metadataHash = ethers.id(formData.metadata || 'default');
      const publicKeyBytes = formData.publicKey.startsWith('0x') 
        ? formData.publicKey 
        : `0x${formData.publicKey}`;

      // Stake amount: 1000 HASHD tokens
      const stakeAmount = ethers.parseEther('1000');
      
      // Get HASHD token contract
      const hashdToken = new ethers.Contract(HASHD_TOKEN_ADDRESS!, ERC20_ABI, signer);
      
      // Check balance
      const balance = await hashdToken.balanceOf(await signer.getAddress());
      if (balance < stakeAmount) {
        alert(`Insufficient HASHD balance. Need ${ethers.formatEther(stakeAmount)} HASHD`);
        return;
      }
      
      // Approve if needed
      const allowance = await hashdToken.allowance(await signer.getAddress(), VAULT_REGISTRY_ADDRESS);
      if (allowance < stakeAmount) {
        const approveTx = await hashdToken.approve(VAULT_REGISTRY_ADDRESS, stakeAmount);
        await approveTx.wait();
      }
      
      const tx = await contract.registerNode(
        publicKeyBytes,
        formData.url,
        metadataHash,
        stakeAmount
      );
      await tx.wait();
      
      alert('Node added successfully!');
      setShowAddForm(false);
      setFormData({ ownerAddress: '', publicKey: '', url: '', metadata: '' });
      setTimeout(() => fetchData(), 500);
    } catch (error: any) {
      console.error('Error adding node:', error);
      alert(`Error: ${error.message}`);
    }
  }

  async function handleUpdateNode(e: React.FormEvent) {
    e.preventDefault();
    if (!editingNode) return;

    try {
      if (!VAULT_REGISTRY_ADDRESS) {
        alert('Registry address not configured');
        return;
      }

      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(VAULT_REGISTRY_ADDRESS, VAULT_REGISTRY_ABI, signer);

      const metadataHash = ethers.id(formData.metadata || 'default');
      const tx = await contract.updateNode(editingNode.nodeId, formData.url, metadataHash);
      await tx.wait();
      
      alert('Node updated successfully!');
      setEditingNode(null);
      setFormData({ ownerAddress: '', publicKey: '', url: '', metadata: '' });
      fetchData();
    } catch (error: any) {
      console.error('Error updating node:', error);
      alert(`Error: ${error.message}`);
    }
  }

  async function handleRemoveNode(nodeId: string) {
    if (!window.confirm('Are you sure you want to remove this node?')) return;

    try {
      if (!VAULT_REGISTRY_ADDRESS) return;

      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(VAULT_REGISTRY_ADDRESS, VAULT_REGISTRY_ABI, signer);

      const tx = await contract.removeNode(nodeId);
      await tx.wait();
      
      alert('Node deactivated successfully!');
      fetchData();
    } catch (error: any) {
      console.error('Error deactivating node:', error);
      alert(`Error: ${error.message}`);
    }
  }

  async function handleReactivateNode(nodeId: string) {
    try {
      if (!VAULT_REGISTRY_ADDRESS) return;

      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(VAULT_REGISTRY_ADDRESS, VAULT_REGISTRY_ABI, signer);

      const tx = await contract.reactivateNode(nodeId);
      await tx.wait();
      
      alert('Node reactivated successfully!');
      fetchData();
    } catch (error: any) {
      console.error('Error reactivating node:', error);
      alert(`Error: ${error.message}`);
    }
  }

  async function handleTestStorage() {
    if (!testText.trim()) {
      alert('Please enter some text to store');
      return;
    }

    const activeNode = nodes.find(n => n.active && n.health?.status === 'healthy');
    if (!activeNode) {
      alert('No healthy nodes available');
      return;
    }

    try {
      setStoring(true);
      setStorageResult(null);

      const encryptedHex = await CryptoUtils.encryptText(testText);
      const ciphertext = new Uint8Array(Buffer.from(encryptedHex, 'hex'));

      // Use P2P store
      const result = await p2pStore(ciphertext, 'text/plain');

      if (!result.success) {
        throw new Error(result.error || 'Storage failed');
      }

      setStorageResult({ cid: result.cid });
      alert(`✅ Successfully stored via P2P!\nCID: ${result.cid}`);
      setTimeout(() => fetchData(), 500);
    } catch (error: any) {
      console.error('Storage error:', error);
      setStorageResult({ error: error.message });
      alert(`❌ Storage failed: ${error.message}`);
    } finally {
      setStoring(false);
    }
  }

  function cancelEdit() {
    setEditingNode(null);
    setFormData({ ownerAddress: '', publicKey: '', url: '', metadata: '' });
  }

  async function handleRegisterPeer(peerId: string) {
    const peer = p2pPeers.find(p => p.peerId === peerId);
    if (!peer) {
      alert('Peer not found');
      return;
    }

    try {
      let publicKey: string | undefined;
      let ownerAddress: string | undefined;
      let nodeUrl: string | undefined;

      // Get node data from health endpoint
      const nodeData = nodes.find(n => {
        if (n.health?.peerId) return n.health.peerId === peerId;
        if (n.nodeId === peerId) return true;
        return false;
      });

      // Try to get public key from health data first
      if (nodeData?.url) {
        try {
          const response = await fetch(`${nodeData.url}/health`);
          if (response.ok) {
            const healthData = await response.json();
            publicKey = healthData.publicKey;
            ownerAddress = healthData.ownerAddress;
            nodeUrl = nodeData.url;
            console.log('[VaultTab] Got public key from health endpoint:', publicKey);
          }
        } catch (err) {
          console.warn('[VaultTab] Failed to fetch health data for registration:', err);
        }
      }

      // Try P2P if health data not available
      if (!publicKey && p2pConnected && peer.connected) {
        console.log('[VaultTab] Trying P2P for node info:', peerId);
        const info = await getNodeInfo(peerId);
        
        if (info && info.publicKey) {
          console.log('[VaultTab] Got P2P node info:', info);
          publicKey = info.publicKey;
          ownerAddress = info.ownerAddress;
          nodeUrl = `p2p://${peerId}`;
        }
      }
      
      // Only prompt if we couldn't get public key from health or P2P
      if (!publicKey) {
        const inputKey = prompt('Enter node public key (hex format):');
        if (!inputKey) {
          alert('Public key is required for registration');
          return;
        }
        publicKey = inputKey;
      }
      
      if (!nodeUrl) {
        const inputUrl = prompt('Enter node URL (e.g., http://localhost:5001 or p2p://peerId):', `p2p://${peerId}`);
        if (!inputUrl) {
          alert('Node URL is required for registration');
          return;
        }
        nodeUrl = inputUrl;
      }

      // Get signer
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();
      
      // Use node's owner address or fall back to connected wallet
      const finalOwner = ownerAddress || signerAddress;

      const contract = new ethers.Contract(VAULT_REGISTRY_ADDRESS!, VAULT_REGISTRY_ABI, signer);
      const metadataHash = ethers.id('bytecave-node');

      // Convert DER-encoded public key to raw bytes if needed
      let publicKeyBytes = publicKey;
      if (publicKey.startsWith('302a')) {
        // DER-encoded Ed25519 public key (44 bytes)
        // Format: 302a300506032b6570032100[32 bytes of actual key]
        // Extract last 32 bytes (raw Ed25519 public key)
        console.log('[VaultTab] Converting DER-encoded public key to raw bytes');
        publicKeyBytes = '0x' + publicKey.slice(-64); // Last 32 bytes in hex
      } else if (!publicKey.startsWith('0x')) {
        // Add 0x prefix if missing
        publicKeyBytes = '0x' + publicKey;
      }

      console.log('[VaultTab] Registering with public key:', publicKeyBytes);
      console.log('[VaultTab] Node URL:', nodeUrl);
      console.log('[VaultTab] Owner will be:', finalOwner, '(msg.sender)');
      
      // Check if node is already registered
      const nodeId = ethers.keccak256(publicKeyBytes);
      console.log('[VaultTab] Node ID will be:', nodeId);
      
      try {
        const existingNode = await contract.getNode(nodeId);
        if (existingNode.active) {
          alert('This node is already registered and active!');
          return;
        }
        console.log('[VaultTab] Node exists but inactive, will re-register');
      } catch (err) {
        console.log('[VaultTab] Node not found, proceeding with registration');
      }
      
      // Stake amount: 1000 HASHD tokens (18 decimals)
      const stakeAmount = ethers.parseEther('1000');
      console.log('[VaultTab] Stake amount:', ethers.formatEther(stakeAmount), 'HASHD');
      
      // Get HASHD token contract
      const hashdToken = new ethers.Contract(HASHD_TOKEN_ADDRESS!, ERC20_ABI, signer);
      
      // Check balance
      const balance = await hashdToken.balanceOf(signerAddress);
      console.log('[VaultTab] HASHD balance:', ethers.formatEther(balance));
      if (balance < stakeAmount) {
        alert(`Insufficient HASHD balance. Need ${ethers.formatEther(stakeAmount)} HASHD, have ${ethers.formatEther(balance)}`);
        return;
      }
      
      // Check allowance
      const allowance = await hashdToken.allowance(signerAddress, VAULT_REGISTRY_ADDRESS);
      console.log('[VaultTab] Current allowance:', ethers.formatEther(allowance));
      
      // Approve if needed
      if (allowance < stakeAmount) {
        console.log('[VaultTab] Approving HASHD tokens...');
        const approveTx = await hashdToken.approve(VAULT_REGISTRY_ADDRESS, stakeAmount);
        await approveTx.wait();
        console.log('[VaultTab] HASHD tokens approved');
      }
      
      // Register node with HASHD token stake
      console.log('[VaultTab] Registering node...');
      const tx = await contract.registerNode(publicKeyBytes, nodeUrl!, metadataHash, stakeAmount);
      await tx.wait();

      alert('Node registered successfully!');
      fetchData();
    } catch (error: any) {
      console.error('Error registering peer:', error);
      alert(`Registration failed: ${error.message}`);
    }
  }

  // Network discovery via P2P only - no HTTP
  // Peers are discovered via libp2p pubsub and DHT, not HTTP crawling
  // The p2pPeers state is updated automatically by the useByteCave hook

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatUptime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-cyan-400" size={32} />
      </div>
    );
  }

  const activeNodes = networkStats?.activeNodes || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Database className="text-cyan-400" size={28} />
            ByteCave Network
          </h2>
          <p className="text-gray-400 mt-1">Decentralized storage network overview</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {networkStats && networkStats.healthyNodes > 0 ? (
              <CheckCircle className="text-green-400" size={20} />
            ) : (
              <AlertCircle className="text-yellow-400" size={20} />
            )}
            <span className="text-sm text-gray-400">{activeNodes} active nodes</span>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-2"
          >
            <Plus size={16} />
            Add Node
          </button>
        </div>
      </div>

      {/* Network Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Registered Nodes</p>
              <p className="text-2xl font-bold text-white mt-1">{networkStats?.activeNodes || 0}</p>
              <p className="text-xs text-gray-500 mt-1">{networkStats?.healthyNodes || 0} healthy</p>
            </div>
            <Server className="text-cyan-400" size={28} />
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Blobs</p>
              <p className="text-2xl font-bold text-white mt-1">{networkStats?.totalBlobs || 0}</p>
              <p className="text-xs text-gray-500 mt-1">across network</p>
            </div>
            <Database className="text-purple-400" size={28} />
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Storage</p>
              <p className="text-2xl font-bold text-white mt-1">{formatBytes(networkStats?.totalSize || 0)}</p>
              <p className="text-xs text-gray-500 mt-1">network-wide</p>
            </div>
            <Server className="text-cyan-400" size={28} />
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Replication</p>
              <p className="text-2xl font-bold text-white mt-1">{replicationStats?.avgReplicationFactor?.toFixed(1) || '0'}x</p>
              <p className="text-xs text-gray-500 mt-1">{replicationStats?.completeReplications || 0} complete</p>
            </div>
            <RefreshCw className="text-green-400" size={28} />
          </div>
        </div>
      </div>

      {/* Test Storage */}
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Test Storage</h3>
        <p className="text-sm text-gray-400 mb-4">
          Enter text to encrypt and store on an active ByteCave node
        </p>
        <div className="space-y-4">
          <textarea
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            placeholder="Enter some text to encrypt and store..."
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none resize-none"
            rows={3}
          />
          <div className="flex items-center gap-4">
            <button
              onClick={handleTestStorage}
              disabled={storing || !testText.trim() || activeNodes === 0}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:bg-gray-700 disabled:cursor-not-allowed"
            >
              {storing ? 'Storing...' : 'Encrypt & Store'}
            </button>
            {storageResult && (
              <div className="flex-1">
                {storageResult.cid && (
                  <span className="text-sm text-green-400">
                    ✅ CID: <span className="font-mono">{storageResult.cid.slice(0, 24)}...</span>
                  </span>
                )}
                {storageResult.error && (
                  <span className="text-sm text-red-400">❌ {storageResult.error}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* P2P Network - Enhanced with peer details */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              {p2pConnected ? <Wifi className="w-5 h-5 text-green-400" /> : <WifiOff className="w-5 h-5 text-gray-500" />}
              P2P Network
            </h3>
            <div className="flex items-center gap-3">
              <span className={`text-sm ${
                p2pState === 'connected' ? 'text-green-400' :
                p2pState === 'connecting' ? 'text-yellow-400' :
                p2pState === 'error' ? 'text-red-400' : 'text-gray-500'
              }`}>
                {p2pState === 'connected' ? `Connected (${p2pPeers.length} peers)` :
                 p2pState === 'connecting' ? 'Connecting...' :
                 p2pState === 'error' ? 'Error' : 'Disconnected'}
              </span>
              <button
                onClick={p2pConnected ? disconnectP2P : connectP2P}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  p2pConnected 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : 'bg-cyan-600 hover:bg-cyan-700 text-white'
                }`}
              >
                {p2pConnected ? 'Disconnect' : 'Connect P2P'}
              </button>
            </div>
          </div>
        </div>
        {p2pError && (
          <p className="text-sm text-red-400 px-4 py-2">{p2pError}</p>
        )}
        
        {/* P2P Peers Table */}
        {p2pPeers.length > 0 ? (
          <table className="w-full">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Peer ID</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Blobs</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Integrity</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Storage</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Uptime</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Success Rate</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Registry</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {p2pPeers.map(peer => {
                const nodeData = nodes.find(n => {
                  if (n.health?.peerId) return n.health.peerId === peer.peerId;
                  if (n.nodeId === peer.peerId) return true;
                  return false;
                });
                const isRegistered = nodeData?.isRegistered || false;
                const health = nodeData?.health;
                
                return (
                  <tr key={peer.peerId} className="hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${peer.connected ? 'bg-green-400' : 'bg-yellow-400'}`} />
                        <div className="flex flex-col">
                          <span className="text-sm text-white font-medium">
                            {health?.isRelay ? 'Relay' : health?.nodeId || 'Unknown Node'}
                          </span>
                          <span className="text-xs text-gray-400 font-mono">
                            {peer.peerId.slice(0, 4)}....{peer.peerId.slice(-4)}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {health ? (
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          health.status === 'healthy'
                            ? 'bg-green-900/50 text-green-400 border border-green-700'
                            : 'bg-red-900/50 text-red-400 border border-red-700'
                        }`}>
                          {health.status}
                        </span>
                      ) : (
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          peer.connected 
                            ? 'bg-green-900/50 text-green-400 border border-green-700'
                            : 'bg-yellow-900/50 text-yellow-400 border border-yellow-700'
                        }`}>
                          {peer.connected ? 'connected' : 'discovered'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {health ? health.storedBlobs : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {health?.integrity ? (
                        (() => {
                          const i = health.integrity;
                          const hasIssues = i.failed > 0 || i.orphaned > 0 || i.metadataTampered > 0;
                          if (hasIssues) {
                            return (
                              <span className="px-2 py-1 text-xs rounded-full bg-red-900/50 text-red-400 border border-red-700">
                                ⚠️ Issues
                              </span>
                            );
                          }
                          return (
                            <span className="px-2 py-1 text-xs rounded-full bg-green-900/50 text-green-400 border border-green-700">
                              ✓ {i.passed}/{i.checked}
                            </span>
                          );
                        })()
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {health ? formatBytes(health.totalSize) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {health ? formatUptime(health.uptime) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {health ? `${(health.successRate * 100).toFixed(1)}%` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {isRegistered ? (
                        <span className="px-2 py-1 text-xs bg-cyan-900/50 text-cyan-400 border border-cyan-700 rounded">
                          Registered
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs bg-gray-700/50 text-gray-400 border border-gray-600 rounded">
                          Unregistered
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {isRegistered && nodeData ? (
                          nodeData.active ? (
                            <button
                              onClick={() => handleRemoveNode(nodeData.nodeId)}
                              className="px-2 py-1 text-xs bg-red-900/50 text-red-400 border border-red-700 rounded hover:bg-red-800/50 transition-colors"
                            >
                              Deregister
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReactivateNode(nodeData.nodeId)}
                              className="px-2 py-1 text-xs bg-green-900/50 text-green-400 border border-green-700 rounded hover:bg-green-800/50 transition-colors"
                            >
                              Reactivate
                            </button>
                          )
                        ) : (
                          <button
                            onClick={() => handleRegisterPeer(peer.peerId)}
                            className="px-2 py-1 text-xs bg-cyan-900/50 text-cyan-400 border border-cyan-700 rounded hover:bg-cyan-800/50 transition-colors"
                          >
                            Register
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="px-4 py-8 text-center text-gray-400">
            {p2pConnected ? 'No peers connected yet' : 'Click "Connect P2P" to discover network peers'}
          </div>
        )}
      </div>

      {/* Add/Edit Form */}
      {(showAddForm || editingNode) && (
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">
            {editingNode ? 'Edit Node' : 'Add New Node'}
          </h3>
          <form onSubmit={editingNode ? handleUpdateNode : handleAddNode} className="space-y-4">
            {!editingNode && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Owner Address</label>
                  <input
                    type="text"
                    value={formData.ownerAddress}
                    onChange={(e) => setFormData({ ...formData, ownerAddress: e.target.value })}
                    placeholder="0x..."
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Public Key (hex)</label>
                  <input
                    type="text"
                    value={formData.publicKey}
                    onChange={(e) => setFormData({ ...formData, publicKey: e.target.value })}
                    placeholder="0x..."
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
                    required
                  />
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Node URL (no trailing slash)</label>
              <input
                type="text"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="http://localhost:3004"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
                required
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
              >
                {editingNode ? 'Update Node' : 'Add Node'}
              </button>
              <button
                type="button"
                onClick={() => { setShowAddForm(false); cancelEdit(); }}
                className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

export default VaultTab;

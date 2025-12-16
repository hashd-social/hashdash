import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { CryptoUtils } from '../../utils/crypto';
import { 
  Database, 
  RefreshCw, 
  Server, 
  Activity,
  CheckCircle,
  AlertCircle,
  Plus
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
  integrity?: {
    checked: number;
    passed: number;
    failed: number;
    orphaned: number;
    metadataTampered: number;
    failedCids: string[];
  };
}

interface NodeWithHealth extends NodeInfo {
  health?: NodeHealth;
  loading?: boolean;
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

// ABI for VaultNodeRegistryV1
const VAULT_REGISTRY_ABI = [
  'function addNode(address _owner, bytes _publicKey, string _url, bytes32 _metadataHash) external returns (bytes32)',
  'function removeNode(bytes32 _nodeId) external',
  'function updateNode(bytes32 _nodeId, string _url, bytes32 _metadataHash) external',
  'function reactivateNode(bytes32 _nodeId) external',
  'function getActiveNodes() external view returns (bytes32[])',
  'function getAllNodes(uint256 _offset, uint256 _limit) external view returns (bytes32[])',
  'function getNode(bytes32 _nodeId) external view returns (tuple(address owner, bytes publicKey, string url, bytes32 metadataHash, uint256 registeredAt, bool active))',
  'function getNodeCount() external view returns (uint256 total, uint256 active)'
];

export const VaultTab: React.FC = () => {
  // Network stats
  const [networkStats, setNetworkStats] = useState<NetworkStats | null>(null);
  const [replicationStats, setReplicationStats] = useState<ReplicationStats | null>(null);
  
  // Nodes
  const [nodes, setNodes] = useState<NodeWithHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingNode, setEditingNode] = useState<NodeInfo | null>(null);
  const [currentAccount, setCurrentAccount] = useState<string>('');
  
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

  // Force purge state
  const [purging, setPurging] = useState<string | null>(null);

  useEffect(() => {
    loadCurrentAccount();
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadCurrentAccount() {
    try {
      if (typeof window.ethereum !== 'undefined') {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        setCurrentAccount(address.toLowerCase());
      }
    } catch (error) {
      console.error('Error loading account:', error);
    }
  }

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

      // Get all nodes (including deactivated) for display
      const nodeIds = await contract.getAllNodes(0, 100);
      
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

      // Fetch health stats for each active node only
      const healthPromises = nodeDetails.map(async (node) => {
        // Skip health check for inactive nodes
        if (!node.active) return null;
        
        try {
          const response = await fetch(`${node.url}/health`, { 
            signal: AbortSignal.timeout(5000) 
          });
          const data = await response.json();
          return {
            status: data.status,
            storedBlobs: data.storedBlobs || 0,
            totalSize: data.totalSize || 0,
            uptime: data.uptime || 0,
            successRate: data.metrics?.successRate || 0,
            peers: data.peers || 0,
            requestsLastHour: data.metrics?.requestsLastHour || 0,
            avgResponseTime: data.metrics?.avgResponseTime || 0,
            integrity: data.integrity
          };
        } catch {
          return null;
        }
      });

      const healthStats = await Promise.all(healthPromises);

      // Update nodes with health
      setNodes(nodeDetails.map((node, i) => ({
        ...node,
        loading: false,
        health: healthStats[i] || undefined
      })));

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

      // Fetch replication stats from first healthy node
      const healthyNode = nodeDetails.find((_, i) => healthStats[i]?.status === 'healthy');
      if (healthyNode) {
        try {
          const response = await fetch(`${healthyNode.url}/replication-stats`);
          if (response.ok) {
            const data = await response.json();
            setReplicationStats(data);
          }
        } catch (error) {
          console.error('Failed to fetch replication stats:', error);
        }
      }

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

      const tx = await contract.addNode(
        formData.ownerAddress,
        publicKeyBytes,
        formData.url,
        metadataHash
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

      const response = await fetch(`${activeNode.url}/store`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ciphertext: encryptedHex,
          mimeType: 'text/plain'
        })
      });

      if (!response.ok) {
        throw new Error(`Storage failed: ${await response.text()}`);
      }

      const result = await response.json();
      setStorageResult({ cid: result.cid });
      alert(`✅ Successfully stored!\nCID: ${result.cid}`);
      setTimeout(() => fetchData(), 500);
    } catch (error: any) {
      console.error('Storage error:', error);
      setStorageResult({ error: error.message });
      alert(`❌ Storage failed: ${error.message}`);
    } finally {
      setStoring(false);
    }
  }

  async function handleForcePurge(nodeUrl: string, nodeId: string) {
    if (!window.confirm(
      '⚠️ DANGER: This will delete ALL blobs from this node.\n\nAre you sure?'
    )) return;

    try {
      setPurging(nodeId);
      const response = await fetch(`${nodeUrl}/admin/force-purge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true })
      });

      if (!response.ok) {
        throw new Error(`Purge failed: ${await response.text()}`);
      }

      const result = await response.json();
      alert(`Purge complete: ${result.deleted} blobs deleted`);
      fetchData();
    } catch (error: any) {
      alert(`Purge failed: ${error.message}`);
    } finally {
      setPurging(null);
    }
  }

  function startEdit(node: NodeInfo) {
    setEditingNode(node);
    setFormData({
      ownerAddress: node.owner,
      publicKey: node.publicKey,
      url: node.url,
      metadata: ''
    });
  }

  function cancelEdit() {
    setEditingNode(null);
    setFormData({ ownerAddress: '', publicKey: '', url: '', metadata: '' });
  }

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
              <p className="text-gray-400 text-sm">Active Nodes</p>
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

      {/* Nodes List */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Registered Nodes</h3>
        </div>
        <table className="w-full">
          <thead className="bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">URL</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Blobs</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Integrity</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Storage</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Uptime</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Success Rate</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {nodes.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No nodes registered yet. Click "Add Node" to register one.
                </td>
              </tr>
            ) : (
              nodes.map((node) => (
                <tr key={node.nodeId} className="hover:bg-gray-700/50 transition-colors">
                  <td className="px-4 py-3">
                    <a
                      href={node.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 hover:underline"
                    >
                      {node.url}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    {!node.active ? (
                      <span className="px-2 py-1 text-xs rounded-full bg-gray-700/50 text-gray-400 border border-gray-600">
                        inactive
                      </span>
                    ) : node.loading ? (
                      <span className="text-gray-500 text-sm">Loading...</span>
                    ) : node.health ? (
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          node.health.status === 'healthy'
                            ? 'bg-green-900/50 text-green-400 border border-green-700'
                            : 'bg-red-900/50 text-red-400 border border-red-700'
                        }`}
                      >
                        {node.health.status}
                      </span>
                    ) : (
                      <span className="text-gray-500 text-sm">Offline</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {node.loading ? '...' : node.health ? node.health.storedBlobs : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {node.loading ? (
                      <span className="text-gray-300">...</span>
                    ) : node.health?.integrity ? (
                      (() => {
                        const i = node.health.integrity;
                        const hasIssues = i.failed > 0 || i.orphaned > 0 || i.metadataTampered > 0;
                        if (hasIssues) {
                          const issues = [];
                          if (i.failed > 0) issues.push(`${i.failed} BAD`);
                          if (i.orphaned > 0) issues.push(`${i.orphaned} ORPHAN`);
                          if (i.metadataTampered > 0) issues.push(`${i.metadataTampered} META`);
                          return (
                            <span 
                              className="px-2 py-1 text-xs rounded-full bg-red-900/50 text-red-400 border border-red-700"
                              title={`Blob: ${i.failed} tampered, Orphaned: ${i.orphaned}, Metadata: ${i.metadataTampered} tampered`}
                            >
                              ⚠️ {issues.join(' ')}
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
                    {node.loading ? '...' : node.health ? formatBytes(node.health.totalSize) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {node.loading ? '...' : node.health ? formatUptime(node.health.uptime) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {node.loading ? '...' : node.health ? `${(node.health.successRate * 100).toFixed(1)}%` : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => startEdit(node)}
                        className="px-3 py-1 text-sm bg-cyan-900/50 text-cyan-400 border border-cyan-700 rounded hover:bg-cyan-800/50 transition-colors"
                      >
                        Edit
                      </button>
                      {node.active ? (
                        <button
                          onClick={() => handleRemoveNode(node.nodeId)}
                          className="px-3 py-1 text-sm bg-red-900/50 text-red-400 border border-red-700 rounded hover:bg-red-800/50 transition-colors"
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReactivateNode(node.nodeId)}
                          className="px-3 py-1 text-sm bg-green-900/50 text-green-400 border border-green-700 rounded hover:bg-green-800/50 transition-colors"
                        >
                          Reactivate
                        </button>
                      )}
                      {currentAccount && node.owner.toLowerCase() === currentAccount && (
                        <button
                          onClick={() => handleForcePurge(node.url, node.nodeId)}
                          disabled={purging === node.nodeId}
                          className="px-3 py-1 text-sm bg-orange-900/50 text-orange-400 border border-orange-700 rounded hover:bg-orange-800/50 transition-colors disabled:opacity-50"
                          title="Force purge all data"
                        >
                          {purging === node.nodeId ? 'Purging...' : 'Purge'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default VaultTab;

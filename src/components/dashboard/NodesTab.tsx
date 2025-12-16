import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { CryptoUtils } from '../../utils/crypto';

// ABI for VaultNodeRegistryV1
const VAULT_REGISTRY_ABI = [
  'function addNode(address _owner, bytes _publicKey, string _url, bytes32 _metadataHash) external returns (bytes32)',
  'function removeNode(bytes32 _nodeId) external',
  'function updateNode(bytes32 _nodeId, string _url, bytes32 _metadataHash) external',
  'function reactivateNode(bytes32 _nodeId) external',
  'function getActiveNodes() external view returns (bytes32[])',
  'function getNode(bytes32 _nodeId) external view returns (tuple(address owner, bytes publicKey, string url, bytes32 metadataHash, uint256 registeredAt, bool active))',
  'function getNodeCount() external view returns (uint256 total, uint256 active)',
  'function isNodeActive(bytes32 _nodeId) external view returns (bool)',
  'event NodeRegistered(bytes32 indexed nodeId, address indexed owner)',
  'event NodeUpdated(bytes32 indexed nodeId)',
  'event NodeUnregistered(bytes32 indexed nodeId)'
];

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
}

interface NodeWithHealth extends NodeInfo {
  health?: NodeHealth;
  loading?: boolean;
}

export default function NodesTab() {
  const [nodes, setNodes] = useState<NodeWithHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalNodes, setTotalNodes] = useState(0);
  const [activeNodes, setActiveNodes] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingNode, setEditingNode] = useState<NodeInfo | null>(null);
  const [expandedNode, setExpandedNode] = useState<string | null>(null);

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
  const [currentAccount, setCurrentAccount] = useState<string>('');

  const registryAddress = process.env.REACT_APP_VAULT_REGISTRY;

  useEffect(() => {
    loadNodes();
    loadCurrentAccount();
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

  async function loadNodes() {
    try {
      setLoading(true);
      
      if (!registryAddress) {
        console.error('REACT_APP_VAULT_REGISTRY not configured');
        return;
      }

      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const contract = new ethers.Contract(registryAddress, VAULT_REGISTRY_ABI, provider);

      // Get node counts
      const [total, active] = await contract.getNodeCount();
      setTotalNodes(Number(total));
      setActiveNodes(Number(active));

      // Get all active nodes
      const nodeIds = await contract.getActiveNodes();
      
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

      // Fetch health stats for each node
      nodeDetails.forEach(async (node, index) => {
        try {
          const response = await fetch(`${node.url}/health`, {
            signal: AbortSignal.timeout(3000)
          });
          const data = await response.json();
          
          setNodes(prev => {
            const updated = [...prev];
            updated[index] = {
              ...updated[index],
              loading: false,
              health: {
                status: data.status,
                storedBlobs: data.storedBlobs || 0,
                totalSize: data.totalSize || 0,
                uptime: data.uptime || 0,
                successRate: data.metrics?.successRate || 0,
                peers: data.peers || 0,
                requestsLastHour: data.metrics?.requestsLastHour || 0,
                avgResponseTime: data.metrics?.avgResponseTime || 0
              }
            };
            return updated;
          });
        } catch (error) {
          setNodes(prev => {
            const updated = [...prev];
            updated[index] = {
              ...updated[index],
              loading: false,
              health: undefined
            };
            return updated;
          });
        }
      });
    } catch (error) {
      console.error('Error loading nodes:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddNode(e: React.FormEvent) {
    e.preventDefault();
    
    try {
      if (!registryAddress) {
        alert('Registry address not configured');
        return;
      }

      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(registryAddress, VAULT_REGISTRY_ABI, signer);

      // Convert metadata to bytes32
      const metadataHash = ethers.id(formData.metadata || 'default');

      // Ensure public key is properly formatted as bytes
      const publicKeyBytes = formData.publicKey.startsWith('0x') 
        ? formData.publicKey 
        : `0x${formData.publicKey}`;

      console.log('Adding node with:', {
        owner: formData.ownerAddress,
        publicKey: publicKeyBytes,
        url: formData.url,
        metadataHash
      });

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
      
      // Refresh nodes after transaction is confirmed
      setTimeout(() => loadNodes(), 500);
    } catch (error: any) {
      console.error('Error adding node:', error);
      alert(`Error: ${error.message}`);
    }
  }

  async function handleUpdateNode(e: React.FormEvent) {
    e.preventDefault();
    
    if (!editingNode) return;

    try {
      if (!registryAddress) {
        alert('Registry address not configured');
        return;
      }

      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(registryAddress, VAULT_REGISTRY_ABI, signer);

      const metadataHash = ethers.id(formData.metadata);

      const tx = await contract.updateNode(
        editingNode.nodeId,
        formData.url,
        metadataHash
      );

      await tx.wait();
      
      alert('Node updated successfully!');
      setEditingNode(null);
      setFormData({ ownerAddress: '', publicKey: '', url: '', metadata: '' });
      loadNodes();
    } catch (error: any) {
      console.error('Error updating node:', error);
      alert(`Error: ${error.message}`);
    }
  }

  async function handleRemoveNode(nodeId: string) {
    if (!window.confirm('Are you sure you want to remove this node?')) return;

    try {
      if (!registryAddress) {
        alert('Registry address not configured');
        return;
      }

      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(registryAddress, VAULT_REGISTRY_ABI, signer);

      const tx = await contract.removeNode(nodeId);
      await tx.wait();
      
      alert('Node removed successfully!');
      loadNodes();
    } catch (error: any) {
      console.error('Error removing node:', error);
      alert(`Error: ${error.message}`);
    }
  }

  async function handleReactivateNode(nodeId: string) {
    try {
      if (!registryAddress) {
        alert('Registry address not configured');
        return;
      }

      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(registryAddress, VAULT_REGISTRY_ABI, signer);

      const tx = await contract.reactivateNode(nodeId);
      await tx.wait();
      
      alert('Node reactivated successfully!');
      loadNodes();
    } catch (error: any) {
      console.error('Error reactivating node:', error);
      alert(`Error: ${error.message}`);
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

  async function handleTestStorage() {
    if (!testText.trim()) {
      alert('Please enter some text to store');
      return;
    }

    if (nodes.length === 0) {
      alert('No active nodes available. Please register a node first.');
      return;
    }

    try {
      setStoring(true);
      setStorageResult(null);

      // Encrypt the text
      const encryptedHex = await CryptoUtils.encryptText(testText);
      console.log('Encrypted text:', encryptedHex);

      // Use first active node
      const targetNode = nodes.find(n => n.active);
      if (!targetNode) {
        throw new Error('No active nodes available');
      }

      // Store on vault (vault generates CID from ciphertext)
      const response = await fetch(`${targetNode.url}/store`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ciphertext: encryptedHex,
          mimeType: 'text/plain'
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Storage failed: ${error}`);
      }

      const result = await response.json();
      console.log('Storage result:', result);

      setStorageResult({ cid: result.cid });
      alert(`✅ Successfully stored!\nCID: ${result.cid}`);
      
      // Refresh node stats after successful storage (small delay to ensure vault has updated)
      setTimeout(() => loadNodes(), 500);
    } catch (error: any) {
      console.error('Storage error:', error);
      setStorageResult({ error: error.message });
      alert(`❌ Storage failed: ${error.message}`);
    } finally {
      setStoring(false);
    }
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

  async function handleForcePurge(nodeUrl: string, nodeId: string) {
    if (!window.confirm(
      '⚠️ DANGER: FORCE PURGE NODE DATA\n\n' +
      'This will IMMEDIATELY delete ALL blobs from this node, bypassing:\n' +
      '- Pin protection\n' +
      '- Shard assignments\n' +
      '- Replication checks\n\n' +
      '⚠️ USE ONLY FOR:\n' +
      '- Local development/testing\n' +
      '- Single-node environments\n' +
      '- Complete node reset\n\n' +
      'This action CANNOT be undone!\n\n' +
      'Continue with force purge?'
    )) {
      return;
    }

    setPurging(nodeId);
    try {
      const response = await fetch(`${nodeUrl}/admin/force-purge`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Force purge request failed');
      }

      const result = await response.json();

      alert(
        `✅ Force Purge Complete\n\n` +
        `Deleted: ${result.deleted} blobs\n` +
        `Freed: ${(result.freedBytes / (1024 * 1024)).toFixed(2)} MB\n\n` +
        `${result.warning || ''}`
      );
    } catch (error: any) {
      alert(`❌ Force purge failed: ${error.message}`);
    } finally {
      setPurging(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center text-gray-400">Loading nodes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-white">ByteCave Nodes</h2>
          <p className="text-gray-400 text-sm mt-1">
            Manage ByteCave storage nodes (V1: Admin-only)
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
        >
          Add Node
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <div className="text-sm text-gray-400">Total Nodes</div>
          <div className="text-2xl font-bold text-white">{totalNodes}</div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <div className="text-sm text-gray-400">Active Nodes</div>
          <div className="text-2xl font-bold text-green-400">{activeNodes}</div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <div className="text-sm text-gray-400">Inactive Nodes</div>
          <div className="text-2xl font-bold text-red-400">{totalNodes - activeNodes}</div>
        </div>
      </div>

      {/* Test Storage */}
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Test Storage</h3>
        <p className="text-sm text-gray-400 mb-4">
          Enter text to encrypt and store on an active ByteCave node
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Text to Store
            </label>
            <textarea
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="Enter some text to encrypt and store..."
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none resize-none"
              rows={4}
            />
          </div>
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
                  <div className="text-sm text-green-400">
                    ✅ Stored! CID: <span className="font-mono">{storageResult.cid.slice(0, 20)}...</span>
                  </div>
                )}
                {storageResult.error && (
                  <div className="text-sm text-red-400">
                    ❌ Error: {storageResult.error}
                  </div>
                )}
              </div>
            )}
          </div>
          {activeNodes === 0 && (
            <div className="text-sm text-yellow-400">
              ⚠️ No active nodes available. Please register a node first.
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Form */}
      {(showAddForm || editingNode) && (
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">
            {editingNode ? 'Edit Node' : 'Add New Node'}
          </h3>
          <form onSubmit={editingNode ? handleUpdateNode : handleAddNode}>
            {!editingNode && (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Owner Address
                  </label>
                  <input
                    type="text"
                    value={formData.ownerAddress}
                    onChange={(e) => setFormData({ ...formData, ownerAddress: e.target.value })}
                    placeholder="0x..."
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Public Key (hex)
                  </label>
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
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Node URL
              </label>
              <input
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://node.example.com"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Metadata (optional)
              </label>
              <input
                type="text"
                value={formData.metadata}
                onChange={(e) => setFormData({ ...formData, metadata: e.target.value })}
                placeholder="Node description or metadata"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
              >
                {editingNode ? 'Update Node' : 'Add Node'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  cancelEdit();
                }}
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
        <table className="w-full">
          <thead className="bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">URL</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Blobs</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Storage</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Uptime</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Success Rate</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {nodes.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No nodes registered yet
                </td>
              </tr>
            ) : (
              nodes.map((node) => (
                <tr key={node.nodeId} className="hover:bg-gray-700/50 transition-colors cursor-pointer"
                    onClick={() => setExpandedNode(expandedNode === node.nodeId ? null : node.nodeId)}>
                  <td className="px-4 py-3">
                    <a
                      href={node.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {node.url}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    {node.loading ? (
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
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {node.loading ? '...' : node.health ? formatBytes(node.health.totalSize) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {node.loading ? '...' : node.health ? formatUptime(node.health.uptime) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {node.loading ? '...' : node.health ? `${(node.health.successRate * 100).toFixed(1)}%` : '-'}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
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
                          Remove
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReactivateNode(node.nodeId)}
                          className="px-3 py-1 text-sm bg-green-900/50 text-green-400 border border-green-700 rounded hover:bg-green-800/50 transition-colors"
                        >
                          Reactivate
                        </button>
                      )}
                      {/* Force Purge - only for owned nodes */}
                      {currentAccount && node.owner.toLowerCase() === currentAccount && (
                        <button
                          onClick={() => handleForcePurge(node.url, node.nodeId)}
                          disabled={purging === node.nodeId}
                          className="px-3 py-1 text-sm bg-orange-900/50 text-orange-400 border border-orange-700 rounded hover:bg-orange-800/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Force purge all data from this node"
                        >
                          {purging === node.nodeId ? 'Purging...' : 'Force Purge'}
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
}

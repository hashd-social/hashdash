import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { 
  Database, 
  RefreshCw, 
  Server, 
  Activity,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

interface NodeInfo {
  nodeId: string;
  owner: string;
  url: string;
  active: boolean;
}

interface NodeHealth {
  status: string;
  storedBlobs: number;
  totalSize: number;
  successRate: number;
}

interface NetworkStats {
  totalNodes: number;
  activeNodes: number;
  totalBlobs: number;
  totalSize: number;
  avgSuccessRate: number;
  healthyNodes: number;
}

interface GCStatus {
  enabled: boolean;
  lastRun: number;
  nextRun: number;
  stats: {
    checked: number;
    deleted: number;
    freedBytes: number;
  };
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
  'function getActiveNodes() external view returns (bytes32[])',
  'function getNode(bytes32 _nodeId) external view returns (tuple(address owner, bytes publicKey, string url, bytes32 metadataHash, uint256 registeredAt, bool active))',
  'function getNodeCount() external view returns (uint256 total, uint256 active)'
];

export const VaultTab: React.FC = () => {
  const [networkStats, setNetworkStats] = useState<NetworkStats | null>(null);
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [replicationStats, setReplicationStats] = useState<ReplicationStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchNetworkStats = async () => {
    try {
      if (!VAULT_REGISTRY_ADDRESS) {
        console.error('REACT_APP_VAULT_REGISTRY not configured');
        return;
      }

      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const contract = new ethers.Contract(VAULT_REGISTRY_ADDRESS, VAULT_REGISTRY_ABI, provider);

      // Get node counts from registry
      const [total, active] = await contract.getNodeCount();
      const totalNodes = Number(total);
      const activeNodes = Number(active);

      // Get all active nodes
      const nodeIds = await contract.getActiveNodes();
      
      // Fetch details for each node
      const nodeDetails: NodeInfo[] = await Promise.all(
        nodeIds.map(async (nodeId: string) => {
          const node = await contract.getNode(nodeId);
          return {
            nodeId,
            owner: node[0],
            url: node[2],
            active: node[5]
          };
        })
      );

      setNodes(nodeDetails);

      // Fetch health stats from each active node
      const healthPromises = nodeDetails.map(async (node) => {
        try {
          const response = await fetch(`${node.url}/health`, { 
            signal: AbortSignal.timeout(3000) 
          });
          const data = await response.json();
          return {
            status: data.status,
            storedBlobs: data.storedBlobs || 0,
            totalSize: data.totalSize || 0,
            successRate: data.metrics?.successRate || 0
          };
        } catch (error) {
          return {
            status: 'unhealthy',
            storedBlobs: 0,
            totalSize: 0,
            successRate: 0
          };
        }
      });

      const healthStats = await Promise.all(healthPromises);

      // Aggregate network stats
      const totalBlobs = healthStats.reduce((sum, h) => sum + h.storedBlobs, 0);
      const totalSize = healthStats.reduce((sum, h) => sum + h.totalSize, 0);
      const healthyNodes = healthStats.filter(h => h.status === 'healthy').length;
      const avgSuccessRate = healthStats.length > 0
        ? healthStats.reduce((sum, h) => sum + h.successRate, 0) / healthStats.length
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
      const healthyNode = nodeDetails.find((_, i) => healthStats[i].status === 'healthy');
      if (healthyNode) {
        try {
          const response = await fetch(`${healthyNode.url}/replication/stats`);
          const data = await response.json();
          setReplicationStats(data);
        } catch (error) {
          console.error('Failed to fetch replication stats:', error);
        }
      }

    } catch (error) {
      console.error('Failed to fetch network stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNetworkStats();
    const interval = setInterval(fetchNetworkStats, 10000); // Every 10 seconds
    return () => clearInterval(interval);
  }, []);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Database className="text-cyan-400" size={28} />
            ByteCave Network Overview
          </h2>
          <p className="text-gray-400 mt-1">Aggregated statistics across all ByteCave storage nodes</p>
        </div>
        <div className="flex items-center gap-2">
          {networkStats && networkStats.healthyNodes > 0 ? (
            <CheckCircle className="text-green-400" size={24} />
          ) : (
            <AlertCircle className="text-yellow-400" size={24} />
          )}
          <span className="text-sm text-gray-400">{networkStats?.activeNodes || 0} active nodes</span>
        </div>
      </div>

      {/* Network Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Nodes</p>
              <p className="text-2xl font-bold text-white mt-1">{networkStats?.totalNodes || 0}</p>
              <p className="text-xs text-gray-500 mt-1">{networkStats?.activeNodes || 0} active</p>
            </div>
            <Server className="text-cyan-400" size={32} />
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Network Health</p>
              <p className="text-2xl font-bold text-white mt-1">{networkStats?.healthyNodes || 0}</p>
              <p className="text-xs text-gray-500 mt-1">healthy nodes</p>
            </div>
            <Activity className="text-green-400" size={32} />
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Blobs</p>
              <p className="text-2xl font-bold text-white mt-1">{networkStats?.totalBlobs || 0}</p>
              <p className="text-xs text-gray-500 mt-1">across network</p>
            </div>
            <Database className="text-purple-400" size={32} />
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Storage</p>
              <p className="text-2xl font-bold text-white mt-1">{formatBytes(networkStats?.totalSize || 0)}</p>
              <p className="text-xs text-gray-500 mt-1">network-wide</p>
            </div>
            <Server className="text-cyan-400" size={32} />
          </div>
        </div>
      </div>

      {/* Network Performance */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Activity size={20} className="text-cyan-400" />
          Network Performance
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-900 rounded-lg">
            <p className="text-gray-400 text-sm">Avg Success Rate</p>
            <p className="text-2xl font-bold text-white mt-1">
              {((networkStats?.avgSuccessRate || 0) * 100).toFixed(1)}%
            </p>
          </div>
          <div className="p-4 bg-gray-900 rounded-lg">
            <p className="text-gray-400 text-sm">Active / Total Nodes</p>
            <p className="text-2xl font-bold text-white mt-1">
              {networkStats?.activeNodes || 0} / {networkStats?.totalNodes || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Replication Stats */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <RefreshCw size={20} className="text-cyan-400" />
          Replication Status
        </h3>

        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 bg-gray-900 rounded-lg">
            <p className="text-gray-400 text-sm">Total Blobs</p>
            <p className="text-2xl font-bold text-white mt-1">{replicationStats?.totalBlobs || 0}</p>
          </div>
          <div className="p-4 bg-gray-900 rounded-lg">
            <p className="text-gray-400 text-sm">Complete</p>
            <p className="text-2xl font-bold text-green-400 mt-1">{replicationStats?.completeReplications || 0}</p>
          </div>
          <div className="p-4 bg-gray-900 rounded-lg">
            <p className="text-gray-400 text-sm">Incomplete</p>
            <p className="text-2xl font-bold text-yellow-400 mt-1">{replicationStats?.incompleteReplications || 0}</p>
          </div>
          <div className="p-4 bg-gray-900 rounded-lg">
            <p className="text-gray-400 text-sm">Avg Replication Factor</p>
            <p className="text-2xl font-bold text-cyan-400 mt-1">{replicationStats?.avgReplicationFactor?.toFixed(1) || '0.0'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

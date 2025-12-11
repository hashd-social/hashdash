import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Trash2, 
  RefreshCw, 
  Server, 
  Settings, 
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface VaultStats {
  status: string;
  version: string;
  uptime: number;
  storedBlobs: number;
  totalSize: number;
  peers: number;
  metrics: {
    requestsLastHour: number;
    successRate: number;
    avgResponseTime: number;
  };
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

const VAULT_API_URL = process.env.REACT_APP_VAULT_API_URL || 'http://hashd.local:3004';

export const VaultTab: React.FC = () => {
  const [stats, setStats] = useState<VaultStats | null>(null);
  const [gcStatus, setGCStatus] = useState<GCStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [purging, setPurging] = useState(false);
  const [runningGC, setRunningGC] = useState(false);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${VAULT_API_URL}/health`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch vault stats:', error);
    }
  };

  const fetchGCStatus = async () => {
    try {
      const response = await fetch(`${VAULT_API_URL}/gc/status`);
      const data = await response.json();
      setGCStatus(data);
    } catch (error) {
      console.error('Failed to fetch GC status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchGCStatus();
    const interval = setInterval(() => {
      fetchStats();
      fetchGCStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handlePurgeAll = async () => {
    if (!window.confirm('⚠️ WARNING: This will delete ALL blobs and metadata. This action cannot be undone. Continue?')) {
      return;
    }

    setPurging(true);
    try {
      // Get all blobs
      const response = await fetch(`${VAULT_API_URL}/blobs`);
      const { blobs } = await response.json();

      // Delete each blob
      for (const blob of blobs) {
        await fetch(`${VAULT_API_URL}/blob/${blob.cid}`, {
          method: 'DELETE'
        });
      }

      alert(`✅ Purged ${blobs.length} blobs`);
      fetchStats();
    } catch (error) {
      alert(`❌ Purge failed: ${error}`);
    } finally {
      setPurging(false);
    }
  };

  const handleRunGC = async () => {
    setRunningGC(true);
    try {
      const response = await fetch(`${VAULT_API_URL}/admin/gc`, {
        method: 'POST'
      });
      const result = await response.json();
      alert(`✅ GC completed: ${result.deleted} blobs deleted, ${formatBytes(result.freedBytes)} freed`);
      fetchStats();
      fetchGCStatus();
    } catch (error) {
      alert(`❌ GC failed: ${error}`);
    } finally {
      setRunningGC(false);
    }
  };

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
            Vault Node Management
          </h2>
          <p className="text-gray-400 mt-1">Monitor and manage your HASHD vault node</p>
        </div>
        <div className="flex items-center gap-2">
          {stats?.status === 'healthy' ? (
            <CheckCircle className="text-green-400" size={24} />
          ) : (
            <XCircle className="text-red-400" size={24} />
          )}
          <span className="text-sm text-gray-400">v{stats?.version}</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Stored Blobs</p>
              <p className="text-2xl font-bold text-white mt-1">{stats?.storedBlobs || 0}</p>
            </div>
            <Database className="text-cyan-400" size={32} />
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Size</p>
              <p className="text-2xl font-bold text-white mt-1">{formatBytes(stats?.totalSize || 0)}</p>
            </div>
            <Server className="text-purple-400" size={32} />
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Success Rate</p>
              <p className="text-2xl font-bold text-white mt-1">
                {((stats?.metrics.successRate || 0) * 100).toFixed(1)}%
              </p>
            </div>
            <Activity className="text-green-400" size={32} />
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Uptime</p>
              <p className="text-2xl font-bold text-white mt-1">{formatUptime(stats?.uptime || 0)}</p>
            </div>
            <CheckCircle className="text-cyan-400" size={32} />
          </div>
        </div>
      </div>

      {/* Storage Management */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Database size={20} className="text-cyan-400" />
          Storage Management
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-900 rounded-lg">
            <div>
              <p className="text-white font-medium">Purge All Data</p>
              <p className="text-sm text-gray-400 mt-1">
                Delete all blobs and metadata from this node
              </p>
            </div>
            <button
              onClick={handlePurgeAll}
              disabled={purging}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {purging ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <Trash2 size={18} />
              )}
              {purging ? 'Purging...' : 'Purge All'}
            </button>
          </div>

          <div className="p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-lg flex items-start gap-3">
            <AlertTriangle className="text-yellow-400 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-yellow-400 font-medium">Warning</p>
              <p className="text-sm text-yellow-200/80 mt-1">
                Purging data is permanent and cannot be undone. Make sure you have backups if needed.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Garbage Collection */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <RefreshCw size={20} className="text-cyan-400" />
          Garbage Collection
        </h3>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-gray-900 rounded-lg">
              <p className="text-gray-400 text-sm">Blobs Checked</p>
              <p className="text-xl font-bold text-white mt-1">{gcStatus?.stats.checked || 0}</p>
            </div>
            <div className="p-4 bg-gray-900 rounded-lg">
              <p className="text-gray-400 text-sm">Blobs Deleted</p>
              <p className="text-xl font-bold text-white mt-1">{gcStatus?.stats.deleted || 0}</p>
            </div>
            <div className="p-4 bg-gray-900 rounded-lg">
              <p className="text-gray-400 text-sm">Space Freed</p>
              <p className="text-xl font-bold text-white mt-1">
                {formatBytes(gcStatus?.stats.freedBytes || 0)}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-900 rounded-lg">
            <div>
              <p className="text-white font-medium">Run Garbage Collection</p>
              <p className="text-sm text-gray-400 mt-1">
                Manually trigger GC to clean up old blobs
              </p>
            </div>
            <button
              onClick={handleRunGC}
              disabled={runningGC}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              <RefreshCw size={18} className={runningGC ? 'animate-spin' : ''} />
              {runningGC ? 'Running...' : 'Run GC'}
            </button>
          </div>
        </div>
      </div>

      {/* Node Configuration */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Settings size={20} className="text-cyan-400" />
          Node Configuration
        </h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
            <span className="text-gray-400">Node URL</span>
            <span className="text-white font-mono text-sm">{VAULT_API_URL}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
            <span className="text-gray-400">Connected Peers</span>
            <span className="text-white font-mono text-sm">{stats?.peers || 0}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
            <span className="text-gray-400">Requests (Last Hour)</span>
            <span className="text-white font-mono text-sm">{stats?.metrics.requestsLastHour || 0}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
            <span className="text-gray-400">Avg Response Time</span>
            <span className="text-white font-mono text-sm">{stats?.metrics.avgResponseTime || 0}ms</span>
          </div>
        </div>
      </div>
    </div>
  );
};

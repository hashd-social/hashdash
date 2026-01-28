import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { CryptoUtils } from '../../utils/crypto';
import { useByteCaveContext } from '@gethashd/bytecave-browser';
import { CidViewer } from './CidViewer';
import { 
  Database, 
  RefreshCw, 
  Server, 
  Wifi,
  WifiOff
} from 'lucide-react';

// Interfaces
interface VaultTabProps {
  userAddress: string;
}

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
  version?: string;
  minVersion?: string;
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
const APP_REGISTRY_ADDRESS = process.env.REACT_APP_APP_REGISTRY;
const CONTENT_REGISTRY_ADDRESS = process.env.REACT_APP_CONTENT_REGISTRY;
const HASHID_ADDRESS = process.env.REACT_APP_HASHID;

// ABI for ContentRegistry
const CONTENT_REGISTRY_ABI = [
  'function deleteOwnedContent() external returns (uint256)',
  'function getOwnerCidCount(address owner) external view returns (uint256)',
  'function getOwnerCids(address owner) external view returns (bytes32[])'
];

// ABI for HashID
const HASHID_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function tokenIdToName(uint256 tokenId) view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)'
];

// ABI for VaultNodeRegistry
const VAULT_REGISTRY_ABI = [
  'function registerNode(bytes _publicKey, string _peerId, bytes32 _metadataHash, uint256 _stakeAmount, bytes _signature) external returns (bytes32)',
  'function deregisterNode(bytes32 _nodeId) external',
  'function updateNode(bytes32 _nodeId, string _url, bytes32 _metadataHash) external',
  'function reactivateNode(bytes32 _nodeId) external',
  'function setCanRegisterNode(bool _canRegister) external',
  'function canRegisterNode() external view returns (bool)',
  'function getActiveNodes() external view returns (bytes32[])',
  'function getAllNodes(uint256 _offset, uint256 _limit) external view returns (bytes32[])',
  'function getNode(bytes32 _nodeId) external view returns (tuple(address owner, bytes publicKey, string peerId, bytes32 metadataHash, uint256 registeredAt, bool active))',
  'function getNodeCount() external view returns (uint256 total, uint256 active)',
  'function setReplicationFactor(uint256 _factor) external',
  'function replicationFactor() external view returns (uint256)',
  'function setMinVersion(string _version) external',
  'function minVersion() external view returns (string)',
  'function setMinimumStake(uint256 _newMinimum) external',
  'function setMaximumStake(uint256 _newMaximum) external',
  'function setWithdrawalTimelock(uint256 _newTimelock) external',
  'function minimumStake() external view returns (uint256)',
  'function maximumStake() external view returns (uint256)',
  'function withdrawalTimelock() external view returns (uint256)'
];

// ERC20 ABI for HASHD token
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)'
];

// ABI for AppRegistry
const APP_REGISTRY_ABI = [
  'function registerApp(string memory appName) external',
  'function getApp(bytes32 appId) external view returns (string memory appName, address owner, bool active, uint256 registeredAt, uint256 burnedAmount)',
  'function computeAppId(string memory appName) external pure returns (bytes32)',
  'function setBurnAmount(uint256 newBurnAmount) external',
  'function getBurnAmount() external view returns (uint256)',
  'function getAppCount() external view returns (uint256)',
  'function getTotalBurned() external view returns (uint256)',
  'function openRegistrationForAll() external',
  'function openForAll() external view returns (bool)',
  'function deactivateApp(bytes32 appId) external',
  'function reactivateApp(bytes32 appId) external',
  'function grantAuthorization(bytes32 appId, address authorizedAddress) external',
  'function revokeAuthorization(bytes32 appId, address authorizedAddress) external',
  'function isAuthorized(bytes32 appId, address sender) external view returns (bool)',
  'function getAllAppIds() external view returns (bytes32[])'
];

export const VaultTab: React.FC<VaultTabProps> = ({ userAddress }) => {
  // P2P WebRTC client from app-level context
  const { 
    connectionState: p2pState, 
    peers: p2pPeers, 
    isConnected: p2pConnected,
    connect: connectP2P,
    disconnect: disconnectP2P,
    store: p2pStore,
    registerContent,
    getNodeHealth,
    error: p2pError 
  } = useByteCaveContext();

  // Network stats
  const [networkStats, setNetworkStats] = useState<NetworkStats | null>(null);
  const [replicationStats] = useState<ReplicationStats | null>(null);
  
  // Nodes
  const [nodes, setNodes] = useState<NodeWithHealth[]>([]);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  const [testAppId, setTestAppId] = useState('hashd');
  const [testMimeType, setTestMimeType] = useState('application/octet-stream');
  const [storageResult, setStorageResult] = useState<{ cid?: string; error?: string } | null>(null);
  const [storing, setStoring] = useState(false);
  const [deletingContent, setDeletingContent] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{ count?: number; error?: string } | null>(null);
  const [userHashIds, setUserHashIds] = useState<Array<{tokenId: string, name: string}>>([]);
  const [selectedHashId, setSelectedHashId] = useState<string>('');

  // Vault Node Registry Configstate
  const [replicationFactor, setReplicationFactorInput] = useState('3');
  const [minVersion, setMinVersionInput] = useState('1.0.0');
  const [canRegisterNode, setCanRegisterNodeState] = useState(false);
  const [minimumStake, setMinimumStakeInput] = useState('100');
  const [maximumStake, setMaximumStakeInput] = useState('100000');
  const [withdrawalTimelock, setWithdrawalTimelockInput] = useState('0');
  const [settingReplicationFactor, setSettingReplicationFactor] = useState(false);
  const [settingMinVersion, setSettingMinVersion] = useState(false);
  const [togglingRegistration, setTogglingRegistration] = useState(false);
  const [settingMinStake, setSettingMinStake] = useState(false);
  const [settingMaxStake, setSettingMaxStake] = useState(false);
  const [settingTimelock, setSettingTimelock] = useState(false);

  // App Registry Config state
  const [newAppName, setNewAppName] = useState('');
  const [burnAmount, setBurnAmountInput] = useState('1000');
  const [registeredApps, setRegisteredApps] = useState<Array<{appId: string, appName: string, owner: string, active: boolean, burnedAmount: string}>>([]);
  const [appCount, setAppCount] = useState(0);
  const [totalBurned, setTotalBurned] = useState('0');
  const [openForAll, setOpenForAll] = useState(false);
  const [registeringApp, setRegisteringApp] = useState(false);
  const [settingBurnAmount, setSettingBurnAmount] = useState(false);
  const [openingRegistration, setOpeningRegistration] = useState(false);

  // Node Registry state
  const [nodePeerId, setNodePeerId] = useState('');
  const [nodePublicKey, setNodePublicKey] = useState('');
  const [nodeStakeAmount, setNodeStakeAmount] = useState('1000');
  const [registeringNode, setRegisteringNode] = useState(false);
  const [findingNode, setFindingNode] = useState(false);
  const [deregisteringNode, setDeregisteringNode] = useState(false);
  const [nodeToDeregister, setNodeToDeregister] = useState('');

  useEffect(() => {
    console.log('[VaultTab] p2pPeers changed, count:', p2pPeers.length, 'peers:', p2pPeers.map(p => p.peerId.slice(0, 8)));
    fetchData();
    fetchAppRegistryData();
    fetchUserHashIds();
    const interval = setInterval(() => {
      fetchData();
      fetchAppRegistryData();
    }, 10000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p2pPeers, userAddress]);

  async function fetchUserHashIds() {
    if (!userAddress || !HASHID_ADDRESS) return;

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const hashIdContract = new ethers.Contract(HASHID_ADDRESS, HASHID_ABI, provider);

      // Use balanceOf + tokenOfOwnerByIndex instead of getTokenIdsByOwner to avoid gas issues
      const balance = await hashIdContract.balanceOf(userAddress);
      const tokens: Array<{ tokenId: string; name: string }> = [];

      for (let i = 0; i < balance; i++) {
        try {
          const tokenId = await hashIdContract.tokenOfOwnerByIndex(userAddress, i);
          const name = await hashIdContract.tokenIdToName(tokenId);
          tokens.push({
            tokenId: tokenId.toString(),
            name: name || `Token #${tokenId}`
          });
        } catch (err) {
          console.error(`Error fetching token at index ${i}:`, err);
        }
      }

      setUserHashIds(tokens);
      if (tokens.length > 0 && !selectedHashId) {
        setSelectedHashId(tokens[0].tokenId);
      }
    } catch (error) {
      console.error('Error fetching HashIDs:', error);
    }
  }

  async function fetchData() {
    try {
      // PURE P2P DISCOVERY - Skip on-chain registry query
      // Discover nodes directly from P2P network via relay peer directory
      console.log('[VaultTab] P2P state:', p2pState, 'Connected:', p2pConnected, 'Peers:', p2pPeers.length);
      
      // Always set loading to false immediately - don't block UI
      setLoading(false);
      
      if (p2pPeers.length === 0) {
        console.log('[VaultTab] No P2P peers available yet - showing empty state');
        setNodes([]);
        return;
      }

      // Use floodsub announcement data only - health protocol is unreliable
      // Filter out relay peers (they don't have nodeId from announcements)
      const discoveredNodes = p2pPeers
        .filter((peer: any) => peer.nodeId) // Only include peers with nodeId (storage nodes, not relays)
        .map((peer: any) => {
          // console.log(`[VaultTab] Using peer data for ${peer.peerId.slice(0, 12)}:`, peer);
          return {
            nodeId: peer.nodeId || peer.peerId.slice(0, 12),
            owner: '',
            publicKey: peer.publicKey || '',
            url: '',
            metadataHash: '',
            registeredAt: 0,
            active: true,
            loading: false,
            isRegistered: peer.isRegistered || false,
            health: {
              status: peer.status || 'healthy',
              storedBlobs: peer.blobCount || 0,
              totalSize: peer.storageUsed || 0,
              uptime: peer.uptime || 0,
              successRate: peer.metrics?.successRate || 1,
              peers: 0,
              requestsLastHour: peer.metrics?.requestsLastHour || 0,
              avgResponseTime: peer.metrics?.avgResponseTime || 0,
              peerId: peer.peerId,
              nodeId: peer.nodeId,
              version: peer.version,
              minVersion: peer.minVersion,
              integrity: peer.integrity
            }
          };
        }) as NodeWithHealth[];

      console.log(`[VaultTab] Discovered ${discoveredNodes.length} nodes via P2P`);
      
      // Fetch contract configuration and node count
      if (VAULT_REGISTRY_ADDRESS) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const contract = new ethers.Contract(VAULT_REGISTRY_ADDRESS, VAULT_REGISTRY_ABI, provider);
          
          // Get total registered nodes count for network stats
          const [totalRegistered, activeRegistered] = await contract.getNodeCount();
          
          // Fetch contract configuration values
          const [canRegister, replFactor, minVer, minStake, maxStake, timelock] = await Promise.all([
            contract.canRegisterNode(),
            contract.replicationFactor(),
            contract.minVersion(),
            contract.minimumStake(),
            contract.maximumStake(),
            contract.withdrawalTimelock()
          ]);
          
          // Update state with contract values
          setCanRegisterNodeState(canRegister);
          setReplicationFactorInput(replFactor.toString());
          setMinVersionInput(minVer);
          setMinimumStakeInput(Math.floor(parseFloat(ethers.formatEther(minStake))).toString());
          setMaximumStakeInput(Math.floor(parseFloat(ethers.formatEther(maxStake))).toString());
          setWithdrawalTimelockInput((timelock / (24 * 60 * 60)).toString()); // Convert seconds to days
          
          // Update network stats with on-chain data
          setNetworkStats(prev => ({
            ...prev!,
            totalNodes: Number(totalRegistered),
            activeNodes: Number(activeRegistered)
          }));
        } catch (err) {
          console.warn('[VaultTab] Could not check on-chain registry:', err);
        }
      }
      
      // Set discovered nodes - registration status comes from health data
      setNodes(discoveredNodes);

      // Aggregate network stats from discovered nodes
      const validHealth = discoveredNodes
        .map(n => n.health)
        .filter((h): h is NonNullable<typeof h> => h !== null && h !== undefined);
      
      const totalBlobs = validHealth.reduce((sum: number, h) => sum + h.storedBlobs, 0);
      const totalSize = validHealth.reduce((sum: number, h) => sum + h.totalSize, 0);
      const healthyNodes = validHealth.filter(h => h.status === 'healthy').length;
      const avgSuccessRate = validHealth.length > 0
        ? validHealth.reduce((sum: number, h) => sum + h.successRate, 0) / validHealth.length
        : 0;

      setNetworkStats({
        totalNodes: discoveredNodes.length,
        activeNodes: discoveredNodes.filter(n => n.active).length,
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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


  async function handleSetReplicationFactor() {
    if (!userAddress) {
      alert('Please connect your wallet first');
      return;
    }

    const factor = parseInt(replicationFactor);
    if (isNaN(factor) || factor < 1 || factor > 10) {
      alert('Please enter a valid replication factor (1-10)');
      return;
    }

    try {
      setSettingReplicationFactor(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      if (!VAULT_REGISTRY_ADDRESS) {
        throw new Error('Vault registry address not configured');
      }
      
      const contract = new ethers.Contract(VAULT_REGISTRY_ADDRESS, VAULT_REGISTRY_ABI, signer);

      const tx = await contract.setReplicationFactor(factor);
      await tx.wait();

      alert(`✅ Replication factor set to ${factor}`);
      setTimeout(() => fetchData(), 500);
    } catch (error: any) {
      console.error('Failed to set replication factor:', error);
      alert(`❌ Failed to set replication factor: ${error.message}`);
    } finally {
      setSettingReplicationFactor(false);
    }
  }

  async function handleSetMinVersion() {
    if (!userAddress) {
      alert('Please connect your wallet first');
      return;
    }

    if (!/^\d+\.\d+\.\d+$/.test(minVersion)) {
      alert('Please enter a valid version (e.g., 1.0.0)');
      return;
    }

    try {
      setSettingMinVersion(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      if (!VAULT_REGISTRY_ADDRESS) {
        throw new Error('Vault registry address not configured');
      }
      
      const contract = new ethers.Contract(VAULT_REGISTRY_ADDRESS, VAULT_REGISTRY_ABI, signer);

      const tx = await contract.setMinVersion(minVersion);
      await tx.wait();

      alert(`✅ Minimum version set to ${minVersion}`);
      setTimeout(() => fetchData(), 500);
    } catch (error: any) {
      console.error('Failed to set min version:', error);
      alert(`❌ Failed to set min version: ${error.message}`);
    } finally {
      setSettingMinVersion(false);
    }
  }

  async function handleToggleRegistration() {
    if (!userAddress) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      setTogglingRegistration(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      if (!VAULT_REGISTRY_ADDRESS) {
        throw new Error('Vault registry address not configured');
      }
      
      const contract = new ethers.Contract(VAULT_REGISTRY_ADDRESS, VAULT_REGISTRY_ABI, signer);

      const newValue = !canRegisterNode;
      const tx = await contract.setCanRegisterNode(newValue);
      await tx.wait();

      setCanRegisterNodeState(newValue);
      alert(`✅ Node registration ${newValue ? 'enabled' : 'disabled'}`);
      setTimeout(() => fetchData(), 500);
    } catch (error: any) {
      console.error('Failed to toggle registration:', error);
      alert(`❌ Failed to toggle registration: ${error.message}`);
    } finally {
      setTogglingRegistration(false);
    }
  }

  async function handleSetMinimumStake() {
    if (!userAddress) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      setSettingMinStake(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      if (!VAULT_REGISTRY_ADDRESS) {
        throw new Error('Vault registry address not configured');
      }
      
      const contract = new ethers.Contract(VAULT_REGISTRY_ADDRESS, VAULT_REGISTRY_ABI, signer);
      const stakeInWei = ethers.parseEther(minimumStake);
      const tx = await contract.setMinimumStake(stakeInWei);
      await tx.wait();

      alert(`✅ Minimum stake set to ${minimumStake} HASHD`);
      setTimeout(() => fetchData(), 500);
    } catch (error: any) {
      console.error('Failed to set minimum stake:', error);
      alert(`❌ Failed to set minimum stake: ${error.message}`);
    } finally {
      setSettingMinStake(false);
    }
  }

  async function handleSetMaximumStake() {
    if (!userAddress) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      setSettingMaxStake(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      if (!VAULT_REGISTRY_ADDRESS) {
        throw new Error('Vault registry address not configured');
      }
      
      const contract = new ethers.Contract(VAULT_REGISTRY_ADDRESS, VAULT_REGISTRY_ABI, signer);
      const stakeInWei = ethers.parseEther(maximumStake);
      const tx = await contract.setMaximumStake(stakeInWei);
      await tx.wait();

      alert(`✅ Maximum stake set to ${maximumStake} HASHD`);
      setTimeout(() => fetchData(), 500);
    } catch (error: any) {
      console.error('Failed to set maximum stake:', error);
      alert(`❌ Failed to set maximum stake: ${error.message}`);
    } finally {
      setSettingMaxStake(false);
    }
  }

  async function handleSetWithdrawalTimelock() {
    if (!userAddress) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      setSettingTimelock(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      if (!VAULT_REGISTRY_ADDRESS) {
        throw new Error('Vault registry address not configured');
      }
      
      const contract = new ethers.Contract(VAULT_REGISTRY_ADDRESS, VAULT_REGISTRY_ABI, signer);
      const timelockInSeconds = parseInt(withdrawalTimelock) * 24 * 60 * 60; // Convert days to seconds
      const tx = await contract.setWithdrawalTimelock(timelockInSeconds);
      await tx.wait();

      alert(`✅ Withdrawal timelock set to ${withdrawalTimelock} days`);
      setTimeout(() => fetchData(), 500);
    } catch (error: any) {
      console.error('Failed to set withdrawal timelock:', error);
      alert(`❌ Failed to set withdrawal timelock: ${error.message}`);
    } finally {
      setSettingTimelock(false);
    }
  }

  async function handleRegisterApp() {
    if (!userAddress) {
      alert('Please connect your wallet first');
      return;
    }

    if (!newAppName.trim()) {
      alert('Please enter an app name');
      return;
    }

    try {
      setRegisteringApp(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      if (!APP_REGISTRY_ADDRESS) {
        throw new Error('App registry address not configured');
      }
      
      const contract = new ethers.Contract(APP_REGISTRY_ADDRESS, APP_REGISTRY_ABI, signer);
      
      // Get burn amount
      const burnAmountWei = await contract.getBurnAmount();
      
      // Approve tokens first
      if (HASHD_TOKEN_ADDRESS) {
        const tokenContract = new ethers.Contract(HASHD_TOKEN_ADDRESS, ERC20_ABI, signer);
        const approveTx = await tokenContract.approve(APP_REGISTRY_ADDRESS, burnAmountWei);
        await approveTx.wait();
      }
      
      // Register app
      const tx = await contract.registerApp(newAppName);
      await tx.wait();

      alert(`✅ App "${newAppName}" registered successfully!`);
      setNewAppName('');
      setTimeout(() => fetchAppRegistryData(), 500);
    } catch (error: any) {
      console.error('Failed to register app:', error);
      alert(`❌ Failed to register app: ${error.message}`);
    } finally {
      setRegisteringApp(false);
    }
  }

  async function handleSetBurnAmount() {
    if (!userAddress) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      setSettingBurnAmount(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      if (!APP_REGISTRY_ADDRESS) {
        throw new Error('App registry address not configured');
      }
      
      const contract = new ethers.Contract(APP_REGISTRY_ADDRESS, APP_REGISTRY_ABI, signer);
      const burnAmountWei = ethers.parseEther(burnAmount);
      const tx = await contract.setBurnAmount(burnAmountWei);
      await tx.wait();

      alert(`✅ Burn amount set to ${burnAmount} HASHD`);
      setTimeout(() => fetchAppRegistryData(), 500);
    } catch (error: any) {
      console.error('Failed to set burn amount:', error);
      alert(`❌ Failed to set burn amount: ${error.message}`);
    } finally {
      setSettingBurnAmount(false);
    }
  }

  async function handleFindNode() {
    if (!nodePeerId.trim()) {
      alert('Please enter a peer ID first');
      return;
    }

    try {
      setFindingNode(true);
      
      // Check if P2P is connected
      if (!p2pConnected) {
        alert('⚠️ P2P not connected.\nPlease wait for P2P connection or enter the public key manually.');
        return;
      }
      
      // Get peer data directly from p2pPeers (already has all data from floodsub announcements)
      const peer = p2pPeers.find(p => p.peerId === nodePeerId) as any;
      if (!peer) {
        alert(`⚠️ Node not found in P2P network.\nPeer ID: ${nodePeerId.slice(0, 20)}...\n\nThe node may be offline or not connected to this P2P network.\nPlease enter the public key manually.`);
        return;
      }
      
      console.log('[VaultTab] Found peer data:', peer);
      
      // The node announces its secp256k1 public key as 'publicKey' in the P2P announcement
      if (peer.publicKey) {
        setNodePublicKey(peer.publicKey);
        alert(`✅ Found node!\nPublic key auto-filled from peer announcement.`);
      } else {
        alert('⚠️ Node found but no public key available.\nPlease enter the public key manually.');
      }
    } catch (error: any) {
      console.error('Failed to find node:', error);
      alert(`❌ Failed to find node: ${error.message}\nPlease enter the public key manually.`);
    } finally {
      setFindingNode(false);
    }
  }

  async function handleDeregisterNode() {
    if (!userAddress) {
      alert('Please connect your wallet first');
      return;
    }

    if (!nodeToDeregister.trim()) {
      alert('Please enter a node ID to deregister');
      return;
    }

    try {
      setDeregisteringNode(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      if (!VAULT_REGISTRY_ADDRESS) {
        throw new Error('Vault registry address not configured');
      }
      
      const contract = new ethers.Contract(VAULT_REGISTRY_ADDRESS, VAULT_REGISTRY_ABI, signer);
      
      // Validate and format nodeId as bytes32
      let nodeIdBytes32: string;
      const trimmedNodeId = nodeToDeregister.trim();
      
      if (trimmedNodeId.startsWith('0x')) {
        // Already has 0x prefix, validate length
        if (trimmedNodeId.length !== 66) {
          alert('Invalid node ID format. Must be 66 characters (0x + 64 hex chars)');
          return;
        }
        nodeIdBytes32 = trimmedNodeId;
      } else {
        // Add 0x prefix if missing
        if (trimmedNodeId.length !== 64) {
          alert('Invalid node ID format. Must be 64 hex characters (or 66 with 0x prefix)');
          return;
        }
        nodeIdBytes32 = '0x' + trimmedNodeId;
      }
      
      // Validate hex format
      if (!/^0x[0-9a-fA-F]{64}$/.test(nodeIdBytes32)) {
        alert('Invalid node ID format. Must be a valid hex string');
        return;
      }
      
      // Check if node exists and is active
      try {
        const nodeInfo = await contract.getNode(nodeIdBytes32);
        if (!nodeInfo.active) {
          alert('This node is already deregistered');
          return;
        }
        
        // Verify ownership
        if (nodeInfo.owner.toLowerCase() !== userAddress.toLowerCase()) {
          alert('You are not the owner of this node');
          return;
        }
      } catch (error) {
        alert('Node not found in registry');
        return;
      }
      
      // Deregister node
      const tx = await contract.deregisterNode(nodeIdBytes32);
      await tx.wait();

      alert(`✅ Node deregistered successfully!\nNode ID: ${nodeIdBytes32.slice(0, 10)}...\nStaked tokens returned to wallet`);
      setNodeToDeregister('');
      setTimeout(() => fetchData(), 500);
    } catch (error: any) {
      console.error('Failed to deregister node:', error);
      alert(`❌ Failed to deregister node: ${error.message}`);
    } finally {
      setDeregisteringNode(false);
    }
  }

  async function handleRegisterNode() {
    if (!userAddress) {
      alert('Please connect your wallet first');
      return;
    }

    if (!nodePeerId.trim()) {
      alert('Please enter a peer ID');
      return;
    }

    try {
      setRegisteringNode(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      if (!VAULT_REGISTRY_ADDRESS) {
        throw new Error('Vault registry address not configured');
      }
      
      const contract = new ethers.Contract(VAULT_REGISTRY_ADDRESS, VAULT_REGISTRY_ABI, signer);
      const stakeAmountWei = ethers.parseEther(nodeStakeAmount);
      
      // Validate public key
      if (!nodePublicKey.trim()) {
        throw new Error('Public key is required');
      }
      
      // Ensure public key has 0x prefix
      const publicKey = nodePublicKey.startsWith('0x') ? nodePublicKey : `0x${nodePublicKey}`;
      
      // Validate public key length (should be 64 bytes uncompressed = 128 hex chars + 0x = 130 total)
      if (publicKey.length !== 130) {
        throw new Error(`Invalid public key length: expected 130 characters (0x + 128 hex), got ${publicKey.length}. Must be 64-byte uncompressed secp256k1 key.`);
      }
      
      // Create metadata hash
      const metadata = {
        version: '1.0.0',
        capabilities: ['storage', 'replication'],
        timestamp: Date.now()
      };
      const metadataHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(metadata)));
      
      // Request signature from the node
      // The node will sign the owner address with its secp256k1 private key
      let signature: string;
      try {
        // Extract node URL from peer ID or use default
        // For now, we'll need the user to provide the node URL or we can try to discover it
        // Assuming node is running locally on default port
        const nodeUrl = 'http://localhost:5001'; // TODO: Make this configurable or discoverable
        
        const signResponse = await fetch(`${nodeUrl}/sign-registration`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ownerAddress: userAddress })
        });
        
        if (!signResponse.ok) {
          const errorText = await signResponse.text();
          throw new Error(`Failed to get signature from node: ${errorText}`);
        }
        
        const signData = await signResponse.json();
        signature = signData.signature;
        
        if (!signature || signature.length !== 132) { // 0x + 130 hex chars (65 bytes)
          throw new Error('Invalid signature received from node');
        }
      } catch (error: any) {
        throw new Error(`Cannot get signature from node: ${error.message}. Make sure your node is running and accessible at http://localhost:5001`);
      }
      
      // Approve HASHD tokens first
      if (HASHD_TOKEN_ADDRESS) {
        const tokenContract = new ethers.Contract(HASHD_TOKEN_ADDRESS, ERC20_ABI, signer);
        const approveTx = await tokenContract.approve(VAULT_REGISTRY_ADDRESS, stakeAmountWei);
        await approveTx.wait();
      }
      
      // Register node
      const tx = await contract.registerNode(
        publicKey,
        nodePeerId,
        metadataHash,
        stakeAmountWei,
        signature
      );
      await tx.wait();

      alert(`✅ Node registered successfully!\nPeer ID: ${nodePeerId}\nStake: ${nodeStakeAmount} HASHD`);
      setNodePeerId('');
      setTimeout(() => fetchData(), 500);
    } catch (error: any) {
      console.error('Failed to register node:', error);
      alert(`❌ Failed to register node: ${error.message}`);
    } finally {
      setRegisteringNode(false);
    }
  }

  async function handleOpenRegistrationForAll() {
    if (!userAddress) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      setOpeningRegistration(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      if (!APP_REGISTRY_ADDRESS) {
        throw new Error('App registry address not configured');
      }
      
      const contract = new ethers.Contract(APP_REGISTRY_ADDRESS, APP_REGISTRY_ABI, signer);
      const tx = await contract.openRegistrationForAll();
      await tx.wait();

      alert('✅ App registration opened for all users!');
      setOpenForAll(true);
      setTimeout(() => fetchAppRegistryData(), 500);
    } catch (error: any) {
      console.error('Failed to open registration:', error);
      alert(`❌ Failed to open registration: ${error.message}`);
    } finally {
      setOpeningRegistration(false);
    }
  }

  async function fetchAppRegistryData() {
    if (!APP_REGISTRY_ADDRESS) {
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(APP_REGISTRY_ADDRESS, APP_REGISTRY_ABI, provider);
      
      // Get app count and stats
      const count = await contract.getAppCount();
      const burned = await contract.getTotalBurned();
      const isOpen = await contract.openForAll();
      const currentBurnAmount = await contract.getBurnAmount();
      
      setAppCount(Number(count));
      setTotalBurned(ethers.formatEther(burned));
      setOpenForAll(isOpen);
      setBurnAmountInput(Math.floor(parseFloat(ethers.formatEther(currentBurnAmount))).toString());
      
      // Fetch all registered apps
      const appIds = await contract.getAllAppIds();
      const apps = await Promise.all(
        appIds.map(async (appId: string) => {
          const [appName, owner, active, , burnedAmount] = await contract.getApp(appId);
          return {
            appId,
            appName,
            owner,
            active,
            burnedAmount: ethers.formatEther(burnedAmount)
          };
        })
      );
      
      setRegisteredApps(apps);
      
    } catch (error) {
      // Silently fail - App Registry is optional
    }
  }

  async function handleTestStorage() {
    if (!testText.trim()) {
      alert('Please enter some text to store');
      return;
    }

    if (!userAddress) {
      alert('Please connect your wallet first');
      return;
    }

    if (!selectedHashId) {
      alert('Please select a HashID token. You must own a HashID to store content.');
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

      // Create signer from MetaMask
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();
      console.log('[Test Storage] Signer address:', signerAddress);
      console.log('[Test Storage] Using HashID token:', selectedHashId);

      const encryptedHex = await CryptoUtils.encryptText(testText);
      // Remove 0x prefix before converting from hex
      const hexString = encryptedHex.startsWith('0x') ? encryptedHex.slice(2) : encryptedHex;
      const ciphertext = new Uint8Array(Buffer.from(hexString, 'hex'));

      // Calculate CID before registration
      const hashBuffer = await crypto.subtle.digest('SHA-256', ciphertext);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const cid = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      let registrationResult = null;
      
      // Step 1: Register content in ContentRegistry (on-chain) with HashID token
      console.log('[Test Storage] Registering content in ContentRegistry:', cid, 'appId:', testAppId, 'hashIdToken:', selectedHashId);
      registrationResult = await registerContent(cid, testAppId, selectedHashId, signer);
      
      if (!registrationResult.success) {
        throw new Error(`ContentRegistry registration failed: ${registrationResult.error}`);
      }

      console.log('[Test Storage] Content registered, tx hash:', registrationResult.txHash);

      // Step 2: Store via P2P with HashID token
      const result = await p2pStore(ciphertext, testMimeType, signer, selectedHashId);

      if (!result.success) {
        throw new Error(result.error || 'Storage failed');
      }

      setStorageResult({ cid: result.cid });
      const successMsg = `✅ Successfully registered and stored!\n\nContentRegistry TX: ${registrationResult?.txHash?.slice(0, 10)}...\nCID: ${result.cid}\nApp ID: ${testAppId}\nHashID: ${userHashIds.find(h => h.tokenId === selectedHashId)?.name}`;
      alert(successMsg);
      setTestText('');
      setTimeout(() => fetchData(), 500);
    } catch (error: any) {
      console.error('Storage error:', error);
      setStorageResult({ error: error.message });
      alert(`❌ Storage failed: ${error.message}`);
    } finally {
      setStoring(false);
    }
  }

  async function handleDeleteOwnedContent() {
    if (!userAddress) {
      alert('Please connect your wallet first');
      return;
    }

    if (!CONTENT_REGISTRY_ADDRESS) {
      alert('ContentRegistry address not configured');
      return;
    }

    try {
      setDeletingContent(true);
      setDeleteResult(null);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contentRegistry = new ethers.Contract(
        CONTENT_REGISTRY_ADDRESS,
        CONTENT_REGISTRY_ABI,
        signer
      );

      // Get count first to show user
      const count = await contentRegistry.getOwnerCidCount(userAddress);
      
      if (count === BigInt(0)) {
        alert('You have no registered content to delete');
        setDeleteResult({ count: 0 });
        return;
      }

      const confirmed = window.confirm(
        `Are you sure you want to delete all ${count.toString()} of your registered CIDs?\n\n` +
        'This will prevent your content from being replicated by ByteCave nodes.'
      );

      if (!confirmed) {
        setDeletingContent(false);
        return;
      }

      const tx = await contentRegistry.deleteOwnedContent();
      await tx.wait();

      const deletedCount = Number(count);
      setDeleteResult({ count: deletedCount });
      alert(`✅ Successfully deleted ${deletedCount} CID(s) from ContentRegistry!`);
    } catch (error: any) {
      console.error('Delete error:', error);
      setDeleteResult({ error: error.message });
      alert(`❌ Delete failed: ${error.message}`);
    } finally {
      setDeletingContent(false);
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

  const getVersionStatus = (version?: string, minVersion?: string): 'current' | 'outdated' | 'unknown' => {
    if (!version || !minVersion) return 'unknown';
    
    const vParts = version.split('.').map(Number);
    const minParts = minVersion.split('.').map(Number);
    
    const [vMajor = 0, vMinor = 0, vPatch = 0] = vParts;
    const [minMajor = 0, minMinor = 0, minPatch = 0] = minParts;
    
    // Any version mismatch - OUTDATED
    if (vMajor < minMajor || 
        (vMajor === minMajor && vMinor < minMinor) ||
        (vMajor === minMajor && vMinor === minMinor && vPatch < minPatch)) {
      return 'outdated';
    }
    
    return 'current';
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
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Version</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Blobs</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Integrity</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Storage</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Uptime</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Success Rate</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Registry</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {p2pPeers.map(peer => {
                const nodeData = nodes.find(n => {
                  if (n.health?.peerId) return n.health.peerId === peer.peerId;
                  if (n.nodeId === peer.peerId) return true;
                  return false;
                });
                // Use isRegistered directly from peer announcement - it's the source of truth
                const isRegistered = peer.isRegistered || false;
                const health = nodeData?.health;
                const versionStatus = getVersionStatus(health?.version, health?.minVersion);
                
                // Debug logging
                if (health?.version && health?.minVersion) {
                  console.log(`[VaultTab] Node ${health.nodeId}: version=${health.version}, minVersion=${health.minVersion}, versionStatus=${versionStatus}`);
                }
                
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
                        (() => {
                          // Override status with version status if outdated
                          let displayStatus = health.status;
                          let statusClass = '';
                          
                          if (versionStatus === 'outdated') {
                            displayStatus = 'outdated';
                            statusClass = 'bg-yellow-900/50 text-yellow-400 border border-yellow-700';
                          } else if (health.status === 'healthy') {
                            statusClass = 'bg-green-900/50 text-green-400 border border-green-700';
                          } else {
                            statusClass = 'bg-red-900/50 text-red-400 border border-red-700';
                          }
                          
                          return (
                            <span className={`px-2 py-1 text-xs rounded-full ${statusClass}`}>
                              {displayStatus}
                            </span>
                          );
                        })()
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
                      {health?.version || '-'}
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
                        versionStatus === 'outdated' ? (
                          <span className="text-sm font-medium text-yellow-400">
                            Outdated
                          </span>
                        ) : (
                          <span className="text-sm font-medium text-green-400">
                            Registered
                          </span>
                        )
                      ) : (
                        <span className="text-sm font-medium text-gray-500">
                          Unregistered
                        </span>
                      )}
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


      {/* Vault Node Registry Config*/}
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Vault Node Registry Config</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Replication Factor */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Replication Factor (Enforced min of 3)
            </label>
            <p className="text-xs text-gray-400 mb-3">
              Number of copies to maintain across the network
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="10"
                value={replicationFactor}
                onChange={(e) => setReplicationFactorInput(e.target.value)}
                className="w-24 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
              />
              <button
                onClick={handleSetReplicationFactor}
                disabled={settingReplicationFactor || !userAddress}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-700 disabled:cursor-not-allowed"
              >
                {settingReplicationFactor ? 'Setting...' : 'Set Factor'}
              </button>
            </div>
          </div>

          {/* Minimum Version */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Minimum Version
            </label>
            <p className="text-xs text-gray-400 mb-3">
              Required node version (e.g., 1.0.0)
            </p>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={minVersion}
                onChange={(e) => setMinVersionInput(e.target.value)}
                placeholder="1.0.0"
                className="w-32 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
              />
              <button
                onClick={handleSetMinVersion}
                disabled={settingMinVersion || !userAddress}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-700 disabled:cursor-not-allowed"
              >
                {settingMinVersion ? 'Setting...' : 'Set Version'}
              </button>
            </div>
          </div>

          {/* Node Registration Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Node Registration
            </label>
            <p className="text-xs text-gray-400 mb-3">
              Allow users to register new nodes
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleToggleRegistration}
                disabled={togglingRegistration || !userAddress}
                className={`relative inline-flex h-10 w-20 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  canRegisterNode ? 'bg-green-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-8 w-8 transform rounded-full bg-white transition-transform ${
                    canRegisterNode ? 'translate-x-11' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="text-sm text-gray-300">
                {togglingRegistration ? 'Updating...' : canRegisterNode ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>

        {/* Stake and Timelock Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-gray-700">
          {/* Minimum Stake */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Minimum Stake (HASHD)
            </label>
            <p className="text-xs text-gray-400 mb-3">
              Minimum tokens required to register a node
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                value={minimumStake}
                onChange={(e) => setMinimumStakeInput(e.target.value)}
                className="w-32 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
              />
              <button
                onClick={handleSetMinimumStake}
                disabled={settingMinStake || !userAddress}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-700 disabled:cursor-not-allowed"
              >
                {settingMinStake ? 'Setting...' : 'Set Min'}
              </button>
            </div>
          </div>

          {/* Maximum Stake */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Maximum Stake (HASHD)
            </label>
            <p className="text-xs text-gray-400 mb-3">
              Maximum tokens allowed per node
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                value={maximumStake}
                onChange={(e) => setMaximumStakeInput(e.target.value)}
                className="w-32 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
              />
              <button
                onClick={handleSetMaximumStake}
                disabled={settingMaxStake || !userAddress}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-700 disabled:cursor-not-allowed"
              >
                {settingMaxStake ? 'Setting...' : 'Set Max'}
              </button>
            </div>
          </div>

          {/* Withdrawal Timelock */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Withdrawal Timelock (Days)
            </label>
            <p className="text-xs text-gray-400 mb-3">
              Days to wait before withdrawing stake (0 = instant)
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                value={withdrawalTimelock}
                onChange={(e) => setWithdrawalTimelockInput(e.target.value)}
                className="w-24 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
              />
              <button
                onClick={handleSetWithdrawalTimelock}
                disabled={settingTimelock || !userAddress}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-700 disabled:cursor-not-allowed"
              >
                {settingTimelock ? 'Setting...' : 'Set Timelock'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* App Registry Config */}
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">App Registry Config</h3>
        
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 pb-6 border-b border-gray-700">
          <div className="bg-gray-900 p-4 rounded-lg">
            <p className="text-xs text-gray-400 mb-1">Registered Apps</p>
            <p className="text-2xl font-bold text-white">{appCount}</p>
          </div>
          <div className="bg-gray-900 p-4 rounded-lg">
            <p className="text-xs text-gray-400 mb-1">Total HASHD Burned</p>
            <p className="text-2xl font-bold text-orange-400">{totalBurned}</p>
          </div>
          <div className="bg-gray-900 p-4 rounded-lg">
            <p className="text-xs text-gray-400 mb-1">Registration Status</p>
            <p className={`text-lg font-semibold ${openForAll ? 'text-green-400' : 'text-yellow-400'}`}>
              {openForAll ? 'Open to All' : 'Owner Only'}
            </p>
          </div>
          <div className="bg-gray-900 p-4 rounded-lg">
            <p className="text-xs text-gray-400 mb-1">Current Burn Amount</p>
            <p className="text-lg font-bold text-purple-400">{burnAmount} HASHD</p>
          </div>
        </div>

        {/* Controls Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Register New App */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Register New App
            </label>
            <p className="text-xs text-gray-400 mb-3">
              Register a new application (burns HASHD)
            </p>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={newAppName}
                onChange={(e) => setNewAppName(e.target.value)}
                placeholder="my-app"
                className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
              />
              <button
                onClick={handleRegisterApp}
                disabled={registeringApp || !userAddress || !newAppName.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-700 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {registeringApp ? 'Registering...' : 'Register'}
              </button>
            </div>
          </div>

          {/* Set Burn Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Burn Amount (HASHD)
            </label>
            <p className="text-xs text-gray-400 mb-3">
              HASHD tokens required to register an app
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                value={burnAmount}
                onChange={(e) => setBurnAmountInput(e.target.value)}
                className="w-32 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
              />
              <button
                onClick={handleSetBurnAmount}
                disabled={settingBurnAmount || !userAddress}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-700 disabled:cursor-not-allowed"
              >
                {settingBurnAmount ? 'Setting...' : 'Set Amount'}
              </button>
            </div>
          </div>

          {/* Open Registration */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Public Registration
            </label>
            <p className="text-xs text-gray-400 mb-3">
              Allow anyone to register apps (irreversible)
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleOpenRegistrationForAll}
                disabled={openingRegistration || !userAddress || openForAll}
                className={`px-4 py-2 rounded-lg transition-colors disabled:bg-gray-700 disabled:cursor-not-allowed ${
                  openForAll ? 'bg-gray-700 text-gray-400' : 'bg-orange-600 text-white hover:bg-orange-700'
                }`}
              >
                {openingRegistration ? 'Opening...' : openForAll ? 'Already Open' : 'Open for All'}
              </button>
              {openForAll && (
                <span className="text-xs text-green-400">✓ Enabled</span>
              )}
            </div>
          </div>
        </div>

        {/* Registered Apps List */}
        {registeredApps.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-700">
            <h4 className="text-md font-semibold text-white mb-4">Registered Apps ({registeredApps.length})</h4>
            <div className="space-y-3">
              {registeredApps.map((app) => (
                <div key={app.appId} className="bg-gray-900 p-4 rounded-lg border border-gray-700">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">App Name</p>
                      <p className="text-sm font-semibold text-white">{app.appName}</p>
                      <p className="text-xs text-gray-500 mt-1 font-mono break-all">
                        {app.appId.slice(0, 10)}...{app.appId.slice(-8)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Owner</p>
                      <p className="text-sm text-cyan-400 font-mono break-all">
                        {app.owner.slice(0, 6)}...{app.owner.slice(-4)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Burned Amount</p>
                      <p className="text-sm text-orange-400 font-semibold">{app.burnedAmount} HASHD</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Status</p>
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
                        app.active ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                      }`}>
                        {app.active ? '✓ Active' : '✗ Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Node Registry */}
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Node Registry</h3>
        <p className="text-sm text-gray-400 mb-6">
          Register a storage node on-chain using your wallet (no private key required)
        </p>
        
        <div className="space-y-6">
          {/* Peer ID Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Node Peer ID
            </label>
            <p className="text-xs text-gray-400 mb-3">
              The libp2p peer ID of your storage node
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={nodePeerId}
                onChange={(e) => setNodePeerId(e.target.value)}
                placeholder="12D3KooW..."
                className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none font-mono text-sm"
              />
              <button
                onClick={handleFindNode}
                disabled={findingNode || !nodePeerId.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-700 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {findingNode ? 'Finding...' : 'Find Node'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Get peer ID from your node's /health endpoint or click "Find Node" to auto-fetch public key
            </p>
          </div>

          {/* Public Key Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Node Public Key (for on-chain registration)
            </label>
            <p className="text-xs text-gray-400 mb-3">
              The node's secp256k1 public key for on-chain verification (64 bytes uncompressed)
            </p>
            <input
              type="text"
              value={nodePublicKey}
              onChange={(e) => setNodePublicKey(e.target.value)}
              placeholder="0x... (128 hex chars)"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-2">
              Get from /health endpoint → <code className="bg-gray-800 px-1 rounded">secp256k1PublicKey</code> field (must be 64 bytes / 128 hex chars)
            </p>
            <p className="text-xs text-yellow-500 mt-1">
              ⚠️ Must be 64-byte uncompressed format (without 0x04 prefix)
            </p>
          </div>

          {/* Stake Amount Input */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Stake Amount (HASHD)
              </label>
              <p className="text-xs text-gray-400 mb-3">
                Amount of HASHD tokens to stake (minimum: 1000)
              </p>
              <input
                type="number"
                min="1000"
                step="100"
                value={nodeStakeAmount}
                onChange={(e) => setNodeStakeAmount(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
              />
              <p className="text-xs text-gray-500 mt-2">
                Tokens will be staked and locked until deregistration
              </p>
            </div>
          </div>
        </div>

        {/* Register Button */}
        <div className="mt-6 pt-6 border-t border-gray-700">
          <div className="flex items-center gap-4">
            <button
              onClick={handleRegisterNode}
              disabled={registeringNode || !userAddress || !nodePeerId.trim() || !nodePublicKey.trim() || parseFloat(nodeStakeAmount) < 1000}
              className="px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:bg-gray-700 disabled:cursor-not-allowed font-semibold"
            >
              {registeringNode ? 'Registering...' : 'Register Node'}
            </button>
            <div className="text-sm text-gray-400">
              <p>⚠️ This will:</p>
              <ul className="list-disc list-inside mt-1 text-xs space-y-1">
                <li>Approve and stake {nodeStakeAmount} HASHD tokens</li>
                <li>Register your node on-chain via MetaMask</li>
                <li>No private key required - uses wallet signature</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
          <h4 className="text-sm font-semibold text-blue-300 mb-2">🔒 Secure Registration</h4>
          <p className="text-xs text-gray-300 leading-relaxed">
            This method uses your connected wallet (MetaMask) to sign the registration transaction. 
            Your private key never leaves your wallet and is never exposed to the application. 
            This is safer than entering your private key directly into the desktop app.
          </p>
        </div>

        {/* Deregister Node Section */}
        <div className="mt-8 pt-8 border-t border-gray-700">
          <h4 className="text-md font-semibold text-white mb-4">Deregister Node</h4>
          <p className="text-sm text-gray-400 mb-4">
            Remove a node from the registry and recover staked HASHD tokens
          </p>
          
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Node ID (on-chain identifier)
              </label>
              <input
                type="text"
                value={nodeToDeregister}
                onChange={(e) => setNodeToDeregister(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-2">
                Get this from your node's /health endpoint (nodeId field)
              </p>
            </div>
            <div className="pt-6">
              <button
                onClick={handleDeregisterNode}
                disabled={deregisteringNode || !userAddress || !nodeToDeregister.trim()}
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-700 disabled:cursor-not-allowed font-semibold"
              >
                {deregisteringNode ? 'Deregistering...' : 'Deregister'}
              </button>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
            <p className="text-xs text-yellow-300">
              ⚠️ This will return your staked HASHD tokens and remove the node from the registry. 
              All stored blobs will be cleaned up automatically.
            </p>
          </div>
        </div>
      </div>

      {/* Test Storage */}
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Test Storage</h3>
        <p className="text-sm text-gray-400 mb-4">
          Configure and test storage with different parameters
        </p>
        <div className="space-y-4">
          {/* Configuration Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                HashID Token
              </label>
              <select
                value={selectedHashId}
                onChange={(e) => setSelectedHashId(e.target.value)}
                disabled={userHashIds.length === 0}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none text-sm disabled:opacity-50"
              >
                {userHashIds.length === 0 ? (
                  <option value="">No HashID owned</option>
                ) : (
                  userHashIds.map(token => (
                    <option key={token.tokenId} value={token.tokenId}>
                      {token.name} (#{token.tokenId})
                    </option>
                  ))
                )}
              </select>
              <p className="text-xs text-gray-500 mt-1">Required for storage authorization</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                App ID
              </label>
              <input
                type="text"
                value={testAppId}
                onChange={(e) => setTestAppId(e.target.value)}
                placeholder="hashd"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">Test with non-existent app IDs</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                MIME Type
              </label>
              <select
                value={testMimeType}
                onChange={(e) => setTestMimeType(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none text-sm"
              >
                <option value="text/plain">text/plain</option>
                <option value="application/json">application/json</option>
                <option value="application/octet-stream">application/octet-stream</option>                
                <option value="image/png">image/png</option>
                <option value="video/mp4">video/mp4</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Content type for storage</p>
            </div>
          </div>

          {/* Note about on-chain registration */}
          <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-lg p-3 mb-4">
            <p className="text-xs text-cyan-400">
              🔗 All content is automatically registered on-chain in ContentRegistry for permanent discovery and verification
            </p>
          </div>

          {/* Text Input */}
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
            <button
              onClick={handleDeleteOwnedContent}
              disabled={deletingContent || !userAddress}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-700 disabled:cursor-not-allowed"
              title="Delete all your registered content from ContentRegistry"
            >
              {deletingContent ? 'Deleting...' : 'Delete Owned Content'}
            </button>
            {storageResult && (
              <div className="flex-1">
                {storageResult.cid && (
                  <span className="text-sm text-green-400">
                    ✅ CID: <span className="font-mono">{storageResult.cid}</span>
                  </span>
                )}
                {storageResult.error && (
                  <span className="text-sm text-red-400">❌ {storageResult.error}</span>
                )}
              </div>
            )}
            {deleteResult && (
              <div className="flex-1">
                {deleteResult.count !== undefined && (
                  <span className="text-sm text-green-400">
                    ✅ Deleted {deleteResult.count} CID(s)
                  </span>
                )}
                {deleteResult.error && (
                  <span className="text-sm text-red-400">❌ {deleteResult.error}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CID Viewer */}
      <CidViewer />

    </div>
  );
};

export default VaultTab;

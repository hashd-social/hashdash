import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { Plus, Trash2, Edit2, Save, X, Palette, RefreshCw, Gift } from 'lucide-react';
import { useToast } from '../Toast';
import { CONTRACT_ADDRESSES, ACCOUNT_REGISTRY_ABI, HASHD_TAG_ABI } from '../../config/contracts';

interface DomainInfo {
  name: string;
  tierPrices: bigint[];
  accountCount: number;
  color: string;
}

interface DomainsTabProps {
  userAddress: string;
}

export const DomainsTab: React.FC<DomainsTabProps> = ({ userAddress }) => {
  const toast = useToast();
  const [domains, setDomains] = useState<DomainInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [firstFreeEnabled, setFirstFreeEnabled] = useState(true);
  const [togglingFree, setTogglingFree] = useState(false);
  
  // Add domain form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [newTierPrices, setNewTierPrices] = useState(['1', '0.1', '0.01', '0.001', '0.0001']);
  
  // Edit state
  const [editingDomain, setEditingDomain] = useState<string | null>(null);
  const [editTierPrices, setEditTierPrices] = useState<string[]>([]);
  const [editColor, setEditColor] = useState('');

  const fetchDomains = useCallback(async () => {
    if (!CONTRACT_ADDRESSES.ACCOUNT_REGISTRY) {
      setLoading(false);
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accountRegistry = new ethers.Contract(
        CONTRACT_ADDRESSES.ACCOUNT_REGISTRY,
        ACCOUNT_REGISTRY_ABI,
        provider
      );
      const hashdTag = new ethers.Contract(
        CONTRACT_ADDRESSES.HASHD_TAG,
        HASHD_TAG_ABI,
        provider
      );

      // Check ownership
      const owner = await accountRegistry.owner();
      const ownerMatch = owner.toLowerCase() === userAddress.toLowerCase();
      setIsOwner(ownerMatch);

      // Get first free enabled status
      try {
        const freeEnabled = await accountRegistry.firstHashdTagFreeEnabled();
        setFirstFreeEnabled(freeEnabled);
      } catch {
        // Function may not exist on older contracts
      }

      // Get domains
      const domainNames: string[] = await accountRegistry.getAvailableDomains();
      
      const domainInfos: DomainInfo[] = await Promise.all(
        domainNames.map(async (name) => {
          const tierPrices = await accountRegistry.getDomainTierPrices(name);
          const accountCount = await accountRegistry.getDomainAccountCount(name);
          let color = '00ffff'; // Default cyan
          try {
            color = await hashdTag.domainColors(name) || '00ffff';
          } catch {
            // Domain color not set
          }
          return {
            name,
            tierPrices: Array.from(tierPrices),
            accountCount: Number(accountCount),
            color,
          };
        })
      );

      setDomains(domainInfos);
    } catch (error) {
      console.error('Error fetching domains:', error);
      toast.error('Failed to fetch domains');
    } finally {
      setLoading(false);
    }
  }, [userAddress, toast]);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  const handleAddDomain = async () => {
    if (!newDomain.trim()) {
      toast.error('Domain name required');
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const accountRegistry = new ethers.Contract(
        CONTRACT_ADDRESSES.ACCOUNT_REGISTRY,
        ACCOUNT_REGISTRY_ABI,
        signer
      );

      const tierPricesWei = newTierPrices.map(p => ethers.parseEther(p));
      
      toast.info('Submitting transaction...');
      const tx = await accountRegistry.addDomain(newDomain.toLowerCase(), tierPricesWei);
      await tx.wait();
      
      toast.success(`Domain "${newDomain}" added!`);
      setShowAddForm(false);
      setNewDomain('');
      setNewTierPrices(['1', '0.1', '0.01', '0.001', '0.0001']);
      fetchDomains();
    } catch (error: any) {
      console.error('Error adding domain:', error);
      toast.error(error.reason || 'Failed to add domain');
    }
  };

  const handleUpdateTierPrices = async (domain: string) => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const accountRegistry = new ethers.Contract(
        CONTRACT_ADDRESSES.ACCOUNT_REGISTRY,
        ACCOUNT_REGISTRY_ABI,
        signer
      );

      const tierPricesWei = editTierPrices.map(p => ethers.parseEther(p));
      
      toast.info('Submitting transaction...');
      const tx = await accountRegistry.setDomainTierPrices(domain, tierPricesWei);
      await tx.wait();
      
      toast.success('Tier prices updated!');
      setEditingDomain(null);
      fetchDomains();
    } catch (error: any) {
      console.error('Error updating tier prices:', error);
      toast.error(error.reason || 'Failed to update tier prices');
    }
  };

  const handleUpdateColor = async (domain: string) => {
    if (editColor.length !== 6) {
      toast.error('Color must be 6 hex characters');
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const hashdTag = new ethers.Contract(
        CONTRACT_ADDRESSES.HASHD_TAG,
        HASHD_TAG_ABI,
        signer
      );

      toast.info('Submitting transaction...');
      const tx = await hashdTag.setDomainColor(domain, editColor.toLowerCase());
      await tx.wait();
      
      toast.success('Domain color updated!');
      setEditingDomain(null);
      fetchDomains();
    } catch (error: any) {
      console.error('Error updating color:', error);
      toast.error(error.reason || 'Failed to update color');
    }
  };

  const handleRemoveDomain = async (domain: string) => {
    if (!window.confirm(`Remove domain "${domain}"? This cannot be undone.`)) return;

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const accountRegistry = new ethers.Contract(
        CONTRACT_ADDRESSES.ACCOUNT_REGISTRY,
        ACCOUNT_REGISTRY_ABI,
        signer
      );

      toast.info('Submitting transaction...');
      const tx = await accountRegistry.removeDomain(domain);
      await tx.wait();
      
      toast.success(`Domain "${domain}" removed!`);
      fetchDomains();
    } catch (error: any) {
      console.error('Error removing domain:', error);
      toast.error(error.reason || 'Failed to remove domain');
    }
  };

  const startEditing = (domain: DomainInfo) => {
    setEditingDomain(domain.name);
    setEditTierPrices(domain.tierPrices.map(p => ethers.formatEther(p)));
    setEditColor(domain.color);
  };

  const handleToggleFirstFree = async () => {
    setTogglingFree(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const accountRegistry = new ethers.Contract(
        CONTRACT_ADDRESSES.ACCOUNT_REGISTRY,
        ACCOUNT_REGISTRY_ABI,
        signer
      );

      const newValue = !firstFreeEnabled;
      toast.info(`${newValue ? 'Enabling' : 'Disabling'} free first HashdTag...`);
      const tx = await accountRegistry.setFirstHashdTagFreeEnabled(newValue);
      await tx.wait();
      
      setFirstFreeEnabled(newValue);
      toast.success(`Free first HashdTag ${newValue ? 'enabled' : 'disabled'}!`);
    } catch (error: any) {
      console.error('Error toggling first free:', error);
      toast.error(error.reason || 'Failed to toggle setting');
    } finally {
      setTogglingFree(false);
    }
  };

  const tierLabels = ['1 char', '2 chars', '3 chars', '4 chars', '5+ chars'];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="animate-spin text-cyan-400" size={32} />
      </div>
    );
  }

  if (!CONTRACT_ADDRESSES.ACCOUNT_REGISTRY) {
    return (
      <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4 text-yellow-400">
        Contract addresses not configured. Run the start-all script to deploy contracts.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Domain Management</h2>
          <p className="text-gray-400 text-sm">Manage HashdTag domains and tier pricing</p>
        </div>
        {isOwner && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
          >
            <Plus size={18} />
            Add Domain
          </button>
        )}
      </div>

      {!isOwner && (
        <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4 text-yellow-400">
          You are not the contract owner. Domain management is view-only.
        </div>
      )}

      {/* First Free HashdTag Toggle */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Gift className={`${firstFreeEnabled ? 'text-green-400' : 'text-gray-500'}`} size={24} />
            <div>
              <h3 className="text-white font-medium">Free First HashdTag</h3>
              <p className="text-sm text-gray-400">
                {firstFreeEnabled 
                  ? 'New users get their first 5+ character HashdTag for free'
                  : 'All HashdTag registrations require payment'}
              </p>
            </div>
          </div>
          {isOwner ? (
            <button
              onClick={handleToggleFirstFree}
              disabled={togglingFree}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                firstFreeEnabled ? 'bg-green-600' : 'bg-gray-600'
              } ${togglingFree ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  firstFreeEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          ) : (
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              firstFreeEnabled ? 'bg-green-900/50 text-green-400' : 'bg-gray-700 text-gray-400'
            }`}>
              {firstFreeEnabled ? 'ENABLED' : 'DISABLED'}
            </span>
          )}
        </div>
      </div>

      {/* Add Domain Form */}
      {showAddForm && (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-medium text-white mb-4">Add New Domain</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Domain Name</label>
              <input
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="e.g., hashd"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Tier Prices (ETH)</label>
              <div className="grid grid-cols-5 gap-2">
                {tierLabels.map((label, i) => (
                  <div key={i}>
                    <span className="text-xs text-gray-500">{label}</span>
                    <input
                      type="text"
                      value={newTierPrices[i]}
                      onChange={(e) => {
                        const updated = [...newTierPrices];
                        updated[i] = e.target.value;
                        setNewTierPrices(updated);
                      }}
                      className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddDomain}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
              >
                Add Domain
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Domains List */}
      <div className="space-y-4">
        {domains.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No domains configured</div>
        ) : (
          domains.map((domain) => (
            <div key={domain.name} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded"
                    style={{ backgroundColor: `#${domain.color}` }}
                  />
                  <div>
                    <h3 className="text-lg font-medium text-white">@{domain.name}</h3>
                    <p className="text-sm text-gray-400">{domain.accountCount} accounts registered</p>
                  </div>
                </div>
                {isOwner && editingDomain !== domain.name && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEditing(domain)}
                      className="p-2 text-gray-400 hover:text-cyan-400 transition-colors"
                      title="Edit"
                    >
                      <Edit2 size={18} />
                    </button>
                    {domain.accountCount === 0 && (
                      <button
                        onClick={() => handleRemoveDomain(domain.name)}
                        className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                        title="Remove"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {editingDomain === domain.name ? (
                <div className="space-y-4">
                  {/* Edit Tier Prices */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Tier Prices (ETH)</label>
                    <div className="grid grid-cols-5 gap-2">
                      {tierLabels.map((label, i) => (
                        <div key={i}>
                          <span className="text-xs text-gray-500">{label}</span>
                          <input
                            type="text"
                            value={editTierPrices[i]}
                            onChange={(e) => {
                              const updated = [...editTierPrices];
                              updated[i] = e.target.value;
                              setEditTierPrices(updated);
                            }}
                            className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => handleUpdateTierPrices(domain.name)}
                      className="mt-2 flex items-center gap-1 px-3 py-1 bg-cyan-600 hover:bg-cyan-700 text-white text-sm rounded transition-colors"
                    >
                      <Save size={14} />
                      Save Prices
                    </button>
                  </div>

                  {/* Edit Color */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">NFT Background Color</label>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">#</span>
                      <input
                        type="text"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value.replace('#', ''))}
                        maxLength={6}
                        placeholder="00ffff"
                        className="w-24 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                      />
                      <div
                        className="w-8 h-8 rounded border border-gray-600"
                        style={{ backgroundColor: `#${editColor}` }}
                      />
                      <button
                        onClick={() => handleUpdateColor(domain.name)}
                        className="flex items-center gap-1 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded transition-colors"
                      >
                        <Palette size={14} />
                        Save Color
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => setEditingDomain(null)}
                    className="flex items-center gap-1 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
                  >
                    <X size={14} />
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-2">
                  {tierLabels.map((label, i) => (
                    <div key={i} className="bg-gray-700/50 rounded p-2">
                      <span className="text-xs text-gray-500 block">{label}</span>
                      <span className="text-white font-mono">
                        {ethers.formatEther(domain.tierPrices[i])} ETH
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

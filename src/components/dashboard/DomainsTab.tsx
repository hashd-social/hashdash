import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { Plus, Trash2, Edit2, Save, X, Palette, RefreshCw, Gift, DollarSign, ArrowDown } from 'lucide-react';
import { useToast } from '../Toast';
import { CONTRACT_ADDRESSES, ACCOUNT_REGISTRY_ABI, HASHD_ID_ABI } from '../../config/contracts';

// Chainlink ETH/USD Price Feed on Ethereum Mainnet
const CHAINLINK_ETH_USD_FEED = '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419';
const CHAINLINK_ABI = ['function latestAnswer() view returns (int256)'];

// Default USD pricing tiers
const DEFAULT_USD_PRICES = [1000, 500, 250, 50, 10]; // $1000, $500, $250, $50, $10

interface DomainInfo {
  name: string;
  tierPrices: bigint[];
  accountCount: number;
  color: string;
  textColor: string;
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
  
  // ETH price state
  const [ethPrice, setEthPrice] = useState<number | null>(null);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  
  // Add domain form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [newTierPricesUsd, setNewTierPricesUsd] = useState<string[]>(DEFAULT_USD_PRICES.map(String));
  const [newTierPricesEth, setNewTierPricesEth] = useState<string[]>(['0.25', '0.125', '0.0625', '0.0125', '0.0025']);
  
  // Edit state
  const [editingDomain, setEditingDomain] = useState<string | null>(null);
  const [editTierPricesUsd, setEditTierPricesUsd] = useState<string[]>([]);
  const [editTierPricesEth, setEditTierPricesEth] = useState<string[]>([]);
  const [editColor, setEditColor] = useState('');
  const [editTextColor, setEditTextColor] = useState('');

  const fetchDomains = useCallback(async () => {
    console.log('🚀 fetchDomains called');
    console.log('CONTRACT_ADDRESSES.ACCOUNT_REGISTRY:', CONTRACT_ADDRESSES.ACCOUNT_REGISTRY);
    console.log('userAddress:', userAddress);
    
    if (!CONTRACT_ADDRESSES.ACCOUNT_REGISTRY) {
      console.log('❌ No ACCOUNT_REGISTRY address');
      setLoading(false);
      return;
    }

    try {
      console.log('📡 Creating provider...');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      console.log('Network:', network.chainId.toString(), network.name);
      
      const accountRegistry = new ethers.Contract(
        CONTRACT_ADDRESSES.ACCOUNT_REGISTRY,
        ACCOUNT_REGISTRY_ABI,
        provider
      );
      
      const code = await provider.getCode(CONTRACT_ADDRESSES.ACCOUNT_REGISTRY);
      console.log('Contract code length:', code.length, 'bytes');
      const hashID = new ethers.Contract(
        CONTRACT_ADDRESSES.HASHID,
        HASHD_ID_ABI,
        provider
      );

      // Check ownership
      const owner = await accountRegistry.owner();
      const ownerMatch = owner.toLowerCase() === userAddress.toLowerCase();
      console.log('🔍 OWNERSHIP CHECK:');
      console.log('  Contract owner:', owner);
      console.log('  Your address:', userAddress);
      console.log('  Match:', ownerMatch);
      setIsOwner(ownerMatch);

      // Get first free enabled status
      try {
        const freeEnabled = await accountRegistry.firstHashIDFreeEnabled();
        setFirstFreeEnabled(freeEnabled);
      } catch {
        // Function may not exist on older contracts
      }

      // Get domains
      const domainNames: string[] = await accountRegistry.getAvailableDomains();
      
      const domainInfos: DomainInfo[] = await Promise.all(
        domainNames.map(async (name) => {
          const tierPrices = await accountRegistry.getDomainTierPrices(name);
          // Use HashID contract to get actual count of minted HashIDs for this domain
          const accountCount = await hashID.getHashIdCountByDomain(name);
          let color = '00ffff'; // Default cyan
          let textColor = '000000'; // Default black
          try {
            color = await hashID.domainColors(name) || '00ffff';
            textColor = await hashID.domainTextColors(name) || '000000';
          } catch {
            // Domain colors not set
          }
          return {
            name,
            tierPrices: Array.from(tierPrices),
            accountCount: Number(accountCount),
            color,
            textColor,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userAddress]);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  // Fetch ETH price from Chainlink oracle (mainnet)
  const fetchEthPrice = useCallback(async () => {
    setFetchingPrice(true);
    try {
      // Use mainnet provider for Chainlink price feed
      const mainnetProvider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
      const priceFeed = new ethers.Contract(CHAINLINK_ETH_USD_FEED, CHAINLINK_ABI, mainnetProvider);
      
      const answer = await priceFeed.latestAnswer();
      // Chainlink returns price with 8 decimals
      const price = Number(answer) / 1e8;
      setEthPrice(price);
      toast.success(`ETH price updated: $${price.toFixed(2)}`);
      return price;
    } catch (error) {
      console.error('Error fetching ETH price:', error);
      toast.error('Failed to fetch ETH price from Chainlink');
      return null;
    } finally {
      setFetchingPrice(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Convert USD to ETH
  const usdToEth = (usd: number, price: number): string => {
    if (!price || price === 0) return '0';
    return (usd / price).toFixed(6);
  };

  // Convert ETH to USD
  const ethToUsd = (eth: number, price: number): string => {
    if (!price) return '0';
    return (eth * price).toFixed(2);
  };

  // Update a single tier's ETH price from its USD value
  const updateSingleEthFromUsd = (
    index: number,
    usdPrices: string[],
    ethPrices: string[],
    setEth: (prices: string[]) => void
  ) => {
    if (!ethPrice) {
      toast.error('Fetch ETH price first');
      return;
    }
    const usdNum = parseFloat(usdPrices[index]) || 0;
    const updatedEth = [...ethPrices];
    updatedEth[index] = usdToEth(usdNum, ethPrice);
    setEth(updatedEth);
  };

  // Handle USD input change - update corresponding ETH
  const handleUsdChange = (
    index: number, 
    value: string, 
    usdPrices: string[], 
    setUsd: (p: string[]) => void,
    setEth: (p: string[]) => void,
    ethPrices: string[]
  ) => {
    const updatedUsd = [...usdPrices];
    updatedUsd[index] = value;
    setUsd(updatedUsd);
    
    if (ethPrice) {
      const updatedEth = [...ethPrices];
      const usdNum = parseFloat(value) || 0;
      updatedEth[index] = usdToEth(usdNum, ethPrice);
      setEth(updatedEth);
    }
  };

  // Handle ETH input change - update corresponding USD
  const handleEthChange = (
    index: number, 
    value: string, 
    ethPrices: string[], 
    setEth: (p: string[]) => void,
    setUsd: (p: string[]) => void,
    usdPrices: string[]
  ) => {
    const updatedEth = [...ethPrices];
    updatedEth[index] = value;
    setEth(updatedEth);
    
    if (ethPrice) {
      const updatedUsd = [...usdPrices];
      const ethNum = parseFloat(value) || 0;
      updatedUsd[index] = ethToUsd(ethNum, ethPrice);
      setUsd(updatedUsd);
    }
  };

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

      const tierPricesWei = newTierPricesEth.map((p: string) => ethers.parseEther(p || '0'));
      
      toast.info('Submitting transaction...');
      const tx = await accountRegistry.addDomain(newDomain.toLowerCase(), tierPricesWei);
      await tx.wait();
      
      toast.success(`Domain "${newDomain}" added!`);
      setShowAddForm(false);
      setNewDomain('');
      setNewTierPricesUsd(DEFAULT_USD_PRICES.map(String));
      setNewTierPricesEth(['0.25', '0.125', '0.0625', '0.0125', '0.0025']);
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

      const tierPricesWei = editTierPricesEth.map((p: string) => ethers.parseEther(p || '0'));
      
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
      toast.error('Background color must be 6 hex characters');
      return;
    }
    if (editTextColor.length !== 6) {
      toast.error('Text color must be 6 hex characters');
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const hashID = new ethers.Contract(
        CONTRACT_ADDRESSES.HASHID,
        HASHD_ID_ABI,
        signer
      );

      toast.info('Submitting transaction...');
      const tx = await hashID.setDomainColor(domain, editColor.toLowerCase(), editTextColor.toLowerCase());
      await tx.wait();
      
      toast.success('Domain colors updated!');
      setEditingDomain(null);
      fetchDomains();
    } catch (error: any) {
      console.error('Error updating colors:', error);
      toast.error(error.reason || 'Failed to update colors');
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
    const ethPrices = domain.tierPrices.map((p: bigint) => ethers.formatEther(p));
    setEditTierPricesEth(ethPrices);
    // Calculate USD prices if we have ETH price
    if (ethPrice) {
      const usdPrices = ethPrices.map(eth => ethToUsd(parseFloat(eth), ethPrice));
      setEditTierPricesUsd(usdPrices);
    } else {
      setEditTierPricesUsd(['', '', '', '', '']);
    }
    setEditColor(domain.color);
    setEditTextColor(domain.textColor);
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
      toast.info(`${newValue ? 'Enabling' : 'Disabling'} free first HashID...`);
      const tx = await accountRegistry.setFirstHashIDFreeEnabled(newValue);
      await tx.wait();
      
      setFirstFreeEnabled(newValue);
      toast.success(`Free first HashID ${newValue ? 'enabled' : 'disabled'}!`);
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
          <p className="text-gray-400 text-sm">Manage HashID domains and tier pricing</p>
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

      {/* ETH Price Fetch - Global */}
      <div className="flex items-center gap-3 p-3 bg-gray-800 border border-gray-700 rounded-lg">
        <DollarSign className="text-green-400" size={20} />
        <div className="flex-1">
          <span className="text-gray-400 text-sm">ETH/USD Price: </span>
          <span className="text-white font-mono">
            {ethPrice ? `$${ethPrice.toFixed(2)}` : 'Not fetched'}
          </span>
        </div>
        <button
          onClick={fetchEthPrice}
          disabled={fetchingPrice}
          className="flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-sm rounded transition-colors"
        >
          {fetchingPrice ? <RefreshCw className="animate-spin" size={14} /> : <RefreshCw size={14} />}
          Get Latest Price
        </button>
      </div>

      {/* First Free HashID Toggle */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Gift className={`${firstFreeEnabled ? 'text-green-400' : 'text-gray-500'}`} size={24} />
            <div>
              <h3 className="text-white font-medium">Free First HashID</h3>
              <p className="text-sm text-gray-400">
                {firstFreeEnabled 
                  ? 'New users get their first 5+ character HashID for free'
                  : 'All HashID registrations require payment'}
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

            {/* USD Prices */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Tier Prices (USD)</label>
              <div className="grid grid-cols-5 gap-2">
                {tierLabels.map((label, i) => (
                  <div key={i}>
                    <span className="text-xs text-gray-500">{label}</span>
                    <div className="flex items-center gap-1">
                      <div className="relative flex-1">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                        <input
                          type="text"
                          value={newTierPricesUsd[i]}
                          onChange={(e) => handleUsdChange(i, e.target.value, newTierPricesUsd, setNewTierPricesUsd, setNewTierPricesEth, newTierPricesEth)}
                          className="w-full pl-5 pr-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <button
                        onClick={() => updateSingleEthFromUsd(i, newTierPricesUsd, newTierPricesEth, setNewTierPricesEth)}
                        className="p-1 text-gray-400 hover:text-cyan-400 transition-colors"
                        title="Convert to ETH"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ETH Prices */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Tier Prices (ETH) - sent to contract</label>
              <div className="grid grid-cols-5 gap-2">
                {tierLabels.map((label, i) => (
                  <div key={i}>
                    <span className="text-xs text-gray-500">{label}</span>
                    <input
                      type="text"
                      value={newTierPricesEth[i]}
                      onChange={(e) => handleEthChange(i, e.target.value, newTierPricesEth, setNewTierPricesEth, setNewTierPricesUsd, newTierPricesUsd)}
                      className="w-full px-2 py-1 bg-gray-700 border border-cyan-600 rounded text-cyan-400 text-sm font-mono focus:outline-none focus:border-cyan-400"
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
                  {/* Edit USD Prices */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Tier Prices (USD)</label>
                    <div className="grid grid-cols-5 gap-2">
                      {tierLabels.map((label, i) => (
                        <div key={i}>
                          <span className="text-xs text-gray-500">{label}</span>
                          <div className="flex items-center gap-1">
                            <div className="relative flex-1">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                              <input
                                type="text"
                                value={editTierPricesUsd[i]}
                                onChange={(e) => handleUsdChange(i, e.target.value, editTierPricesUsd, setEditTierPricesUsd, setEditTierPricesEth, editTierPricesEth)}
                                className="w-full pl-5 pr-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                              />
                            </div>
                            <button
                              onClick={() => updateSingleEthFromUsd(i, editTierPricesUsd, editTierPricesEth, setEditTierPricesEth)}
                              className="p-1 text-gray-400 hover:text-cyan-400 transition-colors"
                              title="Convert to ETH"
                            >
                              <ArrowDown size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Edit ETH Prices */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Tier Prices (ETH) - sent to contract</label>
                    <div className="grid grid-cols-5 gap-2">
                      {tierLabels.map((label, i) => (
                        <div key={i}>
                          <span className="text-xs text-gray-500">{label}</span>
                          <input
                            type="text"
                            value={editTierPricesEth[i]}
                            onChange={(e) => handleEthChange(i, e.target.value, editTierPricesEth, setEditTierPricesEth, setEditTierPricesUsd, editTierPricesUsd)}
                            className="w-full px-2 py-1 bg-gray-700 border border-cyan-600 rounded text-cyan-400 text-sm font-mono focus:outline-none focus:border-cyan-400"
                          />
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => handleUpdateTierPrices(domain.name)}
                      className="mt-3 flex items-center gap-1 px-3 py-1 bg-cyan-600 hover:bg-cyan-700 text-white text-sm rounded transition-colors"
                    >
                      <Save size={14} />
                      Update Prices on Contract
                    </button>
                  </div>

                  {/* Edit Colors */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">NFT Colors</label>
                    <div className="space-y-2">
                      {/* Background Color */}
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-sm w-24">Background:</span>
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
                      </div>
                      {/* Text Color */}
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-sm w-24">Text:</span>
                        <span className="text-gray-500">#</span>
                        <input
                          type="text"
                          value={editTextColor}
                          onChange={(e) => setEditTextColor(e.target.value.replace('#', ''))}
                          maxLength={6}
                          placeholder="000000"
                          className="w-24 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                        />
                        <div
                          className="w-8 h-8 rounded border border-gray-600"
                          style={{ backgroundColor: `#${editTextColor}` }}
                        />
                      </div>
                      {/* Preview */}
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-sm w-24">Preview:</span>
                        <div
                          className="px-4 py-2 rounded border border-gray-600 font-mono text-sm"
                          style={{ backgroundColor: `#${editColor}`, color: `#${editTextColor}` }}
                        >
                          alice@{domain.name}
                        </div>
                      </div>
                      <button
                        onClick={() => handleUpdateColor(domain.name)}
                        className="flex items-center gap-1 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded transition-colors"
                      >
                        <Palette size={14} />
                        Save Colors
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
                  {tierLabels.map((label, i) => {
                    const ethValue = parseFloat(ethers.formatEther(domain.tierPrices[i]));
                    const usdValue = ethPrice ? ethValue * ethPrice : null;
                    return (
                      <div key={i} className="bg-gray-700/50 rounded p-2">
                        <span className="text-xs text-gray-500 block">{label}</span>
                        <span className="text-cyan-400 font-mono block">
                          {ethValue.toFixed(4)} ETH
                        </span>
                        {usdValue !== null && (
                          <span className="text-green-400 text-xs font-mono">
                            ${usdValue.toFixed(2)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

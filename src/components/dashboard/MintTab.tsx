import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { Sparkles, CheckCircle, XCircle, RefreshCw, AlertCircle, Search, Hash } from 'lucide-react';
import { useToast } from '../Toast';
import { CONTRACT_ADDRESSES, ACCOUNT_REGISTRY_ABI, HASHD_ID_ABI } from '../../config/contracts';

interface MintTabProps {
  userAddress: string;
}

export const MintTab: React.FC<MintTabProps> = ({ userAddress }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [domains, setDomains] = useState<string[]>([]);
  
  // Form state
  const [recipientAddress, setRecipientAddress] = useState('');
  const [hashIDName, setHashIDName] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('');
  const [minting, setMinting] = useState(false);
  
  // Validation state
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);
  const [checkingName, setCheckingName] = useState(false);
  const [addressValid, setAddressValid] = useState<boolean | null>(null);
  
  // HashID lookup state
  const [lookupAddress, setLookupAddress] = useState('');
  const [lookupHashIds, setLookupHashIds] = useState<Array<{ tokenId: string; name: string }>>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupAddressValid, setLookupAddressValid] = useState<boolean | null>(null);

  const fetchData = useCallback(async () => {
    if (!CONTRACT_ADDRESSES.ACCOUNT_REGISTRY || !CONTRACT_ADDRESSES.HASHID) {
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
      const hashID = new ethers.Contract(
        CONTRACT_ADDRESSES.HASHID,
        HASHD_ID_ABI,
        provider
      );

      // Check ownership
      const owner = await hashID.owner();
      setIsOwner(owner.toLowerCase() === userAddress.toLowerCase());

      // Get available domains
      const domainList: string[] = await accountRegistry.getAvailableDomains();
      setDomains(domainList);
      if (domainList.length > 0 && !selectedDomain) {
        setSelectedDomain(domainList[0]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch contract data');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userAddress, selectedDomain]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Validate recipient address
  useEffect(() => {
    if (!recipientAddress) {
      setAddressValid(null);
      return;
    }
    setAddressValid(ethers.isAddress(recipientAddress));
  }, [recipientAddress]);

  // Validate lookup address
  useEffect(() => {
    if (!lookupAddress) {
      setLookupAddressValid(null);
      return;
    }
    setLookupAddressValid(ethers.isAddress(lookupAddress));
  }, [lookupAddress]);

  // Check name availability with debounce
  useEffect(() => {
    if (!hashIDName || !selectedDomain) {
      setNameAvailable(null);
      return;
    }

    // Validate name format locally first
    const isValidFormat = /^[a-z0-9_]+$/.test(hashIDName);
    if (!isValidFormat || hashIDName.length > 15) {
      setNameAvailable(false);
      return;
    }

    setCheckingName(true);
    const timeoutId = setTimeout(async () => {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const hashID = new ethers.Contract(
          CONTRACT_ADDRESSES.HASHID,
          HASHD_ID_ABI,
          provider
        );
        const available = await hashID.isNameAvailable(hashIDName, selectedDomain);
        setNameAvailable(available);
      } catch (error) {
        console.error('Error checking name:', error);
        setNameAvailable(null);
      } finally {
        setCheckingName(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [hashIDName, selectedDomain]);

  const handleMint = async () => {
    if (!recipientAddress || !hashIDName || !selectedDomain || !addressValid || !nameAvailable) {
      return;
    }

    setMinting(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const hashID = new ethers.Contract(
        CONTRACT_ADDRESSES.HASHID,
        HASHD_ID_ABI,
        signer
      );

      toast.info('Submitting mint transaction...');
      const tx = await hashID.ownerMint(recipientAddress, hashIDName, selectedDomain);
      await tx.wait();

      toast.success(`Minted ${hashIDName}@${selectedDomain} to ${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}!`);
      
      // Reset form
      setHashIDName('');
      setNameAvailable(null);
    } catch (error: any) {
      console.error('Error minting:', error);
      toast.error(error.reason || 'Failed to mint HashID');
    } finally {
      setMinting(false);
    }
  };

  const handleUseMyAddress = () => {
    setRecipientAddress(userAddress);
  };

  const handleGetMyAddress = () => {
    setLookupAddress(userAddress);
  };

  const handleLookupHashIds = async () => {
    if (!lookupAddress || !lookupAddressValid || !CONTRACT_ADDRESSES.HASHID) {
      return;
    }

    setLookupLoading(true);
    setLookupHashIds([]);
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const hashIdContract = new ethers.Contract(
        CONTRACT_ADDRESSES.HASHID,
        [
          'function balanceOf(address owner) view returns (uint256)',
          'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
          'function tokenIdToName(uint256 tokenId) view returns (string)'
        ],
        provider
      );

      const balance = await hashIdContract.balanceOf(lookupAddress);
      const tokens: Array<{ tokenId: string; name: string }> = [];

      for (let i = 0; i < balance; i++) {
        try {
          const tokenId = await hashIdContract.tokenOfOwnerByIndex(lookupAddress, i);
          const name = await hashIdContract.tokenIdToName(tokenId);
          tokens.push({
            tokenId: tokenId.toString(),
            name: name || `Token #${tokenId}`
          });
        } catch (err) {
          console.error(`Error fetching token at index ${i}:`, err);
        }
      }

      setLookupHashIds(tokens);
      if (tokens.length === 0) {
        toast.info('No HashIDs found for this address');
      } else {
        toast.success(`Found ${tokens.length} HashID${tokens.length > 1 ? 's' : ''}`);
      }
    } catch (error: any) {
      console.error('Error looking up HashIDs:', error);
      toast.error('Failed to lookup HashIDs');
    } finally {
      setLookupLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="animate-spin text-cyan-400" size={32} />
      </div>
    );
  }

  if (!CONTRACT_ADDRESSES.HASHID) {
    return (
      <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4 text-yellow-400">
        Contract addresses not configured. Run the start-all script to deploy contracts.
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-white">Owner Mint</h2>
          <p className="text-gray-400 text-sm">Mint HashIDs for free to any address</p>
        </div>
        <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4 text-yellow-400">
          <AlertCircle className="inline mr-2" size={18} />
          You are not the contract owner. Only the owner can use this feature.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HashID Lookup Widget */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Search className="text-cyan-400" size={20} />
            Lookup HashIDs by Address
          </h3>
          <p className="text-gray-400 text-sm">Find all HashIDs owned by an Ethereum address</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Ethereum Address</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={lookupAddress}
                  onChange={(e) => setLookupAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
                />
                {lookupAddress && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {lookupAddressValid ? (
                      <CheckCircle className="text-green-400" size={18} />
                    ) : (
                      <XCircle className="text-red-400" size={18} />
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={handleGetMyAddress}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors whitespace-nowrap"
              >
                Get My Address
              </button>
              <button
                onClick={handleLookupHashIds}
                disabled={!lookupAddress || !lookupAddressValid || lookupLoading}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {lookupLoading ? (
                  <>
                    <RefreshCw className="animate-spin" size={18} />
                    Looking up...
                  </>
                ) : (
                  <>
                    <Search size={18} />
                    Lookup
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results */}
          {lookupHashIds.length > 0 && (
            <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-600">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Found {lookupHashIds.length} HashID{lookupHashIds.length > 1 ? 's' : ''}</h4>
              <div className="space-y-2">
                {lookupHashIds.map((hashId) => (
                  <div key={hashId.tokenId} className="flex items-center justify-between bg-gray-800 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <Hash className="text-cyan-400" size={18} />
                      <span className="text-white font-mono text-lg">{hashId.name}</span>
                    </div>
                    <span className="text-gray-500 text-sm">Token #{hashId.tokenId}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Owner Mint Section */}
      {isOwner && (
        <>
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Sparkles className="text-purple-400" size={24} />
              Owner Mint
            </h2>
            <p className="text-gray-400 text-sm">Mint HashIDs for free to any address (owner only)</p>
          </div>

          {/* Info Box */}
          <div className="bg-purple-900/20 border border-purple-600 rounded-lg p-4">
            <p className="text-purple-300 text-sm">
              <strong>Free Minting:</strong> As the contract owner, you can mint HashIDs to any wallet address 
              without paying fees. This is useful for airdrops, rewards, or reserving names.
            </p>
          </div>

          {/* Mint Form */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="space-y-4">
          {/* Recipient Address */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Mint To Address *</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
                />
                {recipientAddress && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {addressValid ? (
                      <CheckCircle className="text-green-400" size={18} />
                    ) : (
                      <XCircle className="text-red-400" size={18} />
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={handleUseMyAddress}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors whitespace-nowrap"
              >
                Use My Address
              </button>
            </div>
            {recipientAddress && !addressValid && (
              <p className="text-red-400 text-xs mt-1">Invalid Ethereum address</p>
            )}
          </div>

          {/* HashID Name */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">HashID Name *</label>
            <div className="relative">
              <input
                type="text"
                value={hashIDName}
                onChange={(e) => setHashIDName(e.target.value.toLowerCase())}
                placeholder="alice"
                maxLength={15}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white font-mono focus:outline-none focus:border-cyan-500"
              />
              {hashIDName && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {checkingName ? (
                    <RefreshCw className="text-cyan-400 animate-spin" size={18} />
                  ) : nameAvailable === true ? (
                    <CheckCircle className="text-green-400" size={18} />
                  ) : nameAvailable === false ? (
                    <XCircle className="text-red-400" size={18} />
                  ) : null}
                </div>
              )}
            </div>
            <p className="text-gray-500 text-xs mt-1">
              Lowercase letters, numbers, and underscores only. Max 15 characters.
            </p>
            {hashIDName && nameAvailable === false && (
              <p className="text-red-400 text-xs mt-1">
                {!/^[a-z0-9_]+$/.test(hashIDName) 
                  ? 'Invalid format: only lowercase letters, numbers, and underscores allowed'
                  : hashIDName.length > 15
                  ? 'Name too long (max 15 characters)'
                  : 'Name already taken'}
              </p>
            )}
          </div>

          {/* Domain Selection */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Domain *</label>
            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
            >
              {domains.map((domain) => (
                <option key={domain} value={domain}>
                  @{domain}
                </option>
              ))}
            </select>
          </div>

          {/* Preview */}
          {hashIDName && selectedDomain && (
            <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-600">
              <span className="text-gray-400 text-sm">Preview:</span>
              <p className="text-2xl font-bold text-cyan-400 font-mono">
                {hashIDName}@{selectedDomain}
              </p>
            </div>
          )}

          {/* Mint Button */}
          <button
            onClick={handleMint}
            disabled={!recipientAddress || !hashIDName || !selectedDomain || !addressValid || !nameAvailable || minting}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
          >
            {minting ? (
              <>
                <RefreshCw className="animate-spin" size={18} />
                Minting...
              </>
            ) : (
              <>
                <Sparkles size={18} />
                Mint HashID (Free)
              </>
            )}
          </button>
          </div>
        </div>
        </>
      )}
    </div>
  );
};

import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { Sparkles, CheckCircle, XCircle, RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from '../Toast';
import { CONTRACT_ADDRESSES, ACCOUNT_REGISTRY_ABI, HASHD_TAG_ABI } from '../../config/contracts';

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
  const [hashdTagName, setHashdTagName] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('');
  const [minting, setMinting] = useState(false);
  
  // Validation state
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);
  const [checkingName, setCheckingName] = useState(false);
  const [addressValid, setAddressValid] = useState<boolean | null>(null);

  const fetchData = useCallback(async () => {
    if (!CONTRACT_ADDRESSES.ACCOUNT_REGISTRY || !CONTRACT_ADDRESSES.HASHD_TAG) {
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
      const owner = await hashdTag.owner();
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
  }, [userAddress, selectedDomain, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Validate address
  useEffect(() => {
    if (!recipientAddress) {
      setAddressValid(null);
      return;
    }
    setAddressValid(ethers.isAddress(recipientAddress));
  }, [recipientAddress]);

  // Check name availability with debounce
  useEffect(() => {
    if (!hashdTagName || !selectedDomain) {
      setNameAvailable(null);
      return;
    }

    // Validate name format locally first
    const isValidFormat = /^[a-z0-9_]+$/.test(hashdTagName);
    if (!isValidFormat || hashdTagName.length > 15) {
      setNameAvailable(false);
      return;
    }

    setCheckingName(true);
    const timeoutId = setTimeout(async () => {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const hashdTag = new ethers.Contract(
          CONTRACT_ADDRESSES.HASHD_TAG,
          HASHD_TAG_ABI,
          provider
        );
        const available = await hashdTag.isNameAvailable(hashdTagName, selectedDomain);
        setNameAvailable(available);
      } catch (error) {
        console.error('Error checking name:', error);
        setNameAvailable(null);
      } finally {
        setCheckingName(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [hashdTagName, selectedDomain]);

  const handleMint = async () => {
    if (!recipientAddress || !hashdTagName || !selectedDomain || !addressValid || !nameAvailable) {
      return;
    }

    setMinting(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const hashdTag = new ethers.Contract(
        CONTRACT_ADDRESSES.HASHD_TAG,
        HASHD_TAG_ABI,
        signer
      );

      toast.info('Submitting mint transaction...');
      const tx = await hashdTag.ownerMint(recipientAddress, hashdTagName, selectedDomain);
      await tx.wait();

      toast.success(`Minted ${hashdTagName}@${selectedDomain} to ${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}!`);
      
      // Reset form
      setHashdTagName('');
      setNameAvailable(null);
    } catch (error: any) {
      console.error('Error minting:', error);
      toast.error(error.reason || 'Failed to mint HashdTag');
    } finally {
      setMinting(false);
    }
  };

  const handleUseMyAddress = () => {
    setRecipientAddress(userAddress);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="animate-spin text-cyan-400" size={32} />
      </div>
    );
  }

  if (!CONTRACT_ADDRESSES.HASHD_TAG) {
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
          <p className="text-gray-400 text-sm">Mint HashdTags for free to any address</p>
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
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Sparkles className="text-purple-400" size={24} />
          Owner Mint
        </h2>
        <p className="text-gray-400 text-sm">Mint HashdTags for free to any address (owner only)</p>
      </div>

      {/* Info Box */}
      <div className="bg-purple-900/20 border border-purple-600 rounded-lg p-4">
        <p className="text-purple-300 text-sm">
          <strong>Free Minting:</strong> As the contract owner, you can mint HashdTags to any wallet address 
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

          {/* HashdTag Name */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">HashdTag Name *</label>
            <div className="relative">
              <input
                type="text"
                value={hashdTagName}
                onChange={(e) => setHashdTagName(e.target.value.toLowerCase())}
                placeholder="alice"
                maxLength={15}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white font-mono focus:outline-none focus:border-cyan-500"
              />
              {hashdTagName && (
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
            {hashdTagName && nameAvailable === false && (
              <p className="text-red-400 text-xs mt-1">
                {!/^[a-z0-9_]+$/.test(hashdTagName) 
                  ? 'Invalid format: only lowercase letters, numbers, and underscores allowed'
                  : hashdTagName.length > 15
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
          {hashdTagName && selectedDomain && (
            <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-600">
              <span className="text-gray-400 text-sm">Preview:</span>
              <p className="text-2xl font-bold text-cyan-400 font-mono">
                {hashdTagName}@{selectedDomain}
              </p>
            </div>
          )}

          {/* Mint Button */}
          <button
            onClick={handleMint}
            disabled={!recipientAddress || !hashdTagName || !selectedDomain || !addressValid || !nameAvailable || minting}
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
                Mint HashdTag (Free)
              </>
            )}
          </button>
        </div>
      </div>

      {/* Recent Mints could go here in the future */}
    </div>
  );
};

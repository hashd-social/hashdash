import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { Percent, Save, RefreshCw } from 'lucide-react';
import { useToast } from '../Toast';
import { CONTRACT_ADDRESSES, HASHD_ID_ABI } from '../../config/contracts';

interface RoyaltiesTabProps {
  userAddress: string;
}

export const RoyaltiesTab: React.FC<RoyaltiesTabProps> = ({ userAddress }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  
  // Current royalty info
  const [currentRecipient, setCurrentRecipient] = useState('');
  const [currentPercentage, setCurrentPercentage] = useState(0);
  
  // Edit form
  const [newRecipient, setNewRecipient] = useState('');
  const [newPercentage, setNewPercentage] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchRoyaltyInfo = useCallback(async () => {
    if (!CONTRACT_ADDRESSES.HASHD_TAG) {
      setLoading(false);
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const hashID = new ethers.Contract(
        CONTRACT_ADDRESSES.HASHD_TAG,
        HASHD_ID_ABI,
        provider
      );

      // Check ownership
      const owner = await hashID.owner();
      setIsOwner(owner.toLowerCase() === userAddress.toLowerCase());

      // Get royalty info (use tokenId 1 and 1 ETH as reference)
      const salePrice = ethers.parseEther('1');
      const [recipient, royaltyAmount] = await hashID.royaltyInfo(1, salePrice);
      
      setCurrentRecipient(recipient);
      // Calculate percentage from royalty amount (royaltyAmount / salePrice * 100)
      const percentage = Number(royaltyAmount) / Number(salePrice) * 100;
      setCurrentPercentage(percentage);
      
      // Pre-fill form
      setNewRecipient(recipient);
      setNewPercentage(percentage.toString());
    } catch (error) {
      console.error('Error fetching royalty info:', error);
      toast.error('Failed to fetch royalty info');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userAddress]);

  useEffect(() => {
    fetchRoyaltyInfo();
  }, [fetchRoyaltyInfo]);

  const handleUpdateRoyalty = async () => {
    if (!newRecipient || !ethers.isAddress(newRecipient)) {
      toast.error('Invalid recipient address');
      return;
    }

    const percentageNum = parseFloat(newPercentage);
    if (isNaN(percentageNum) || percentageNum < 0 || percentageNum > 100) {
      toast.error('Percentage must be between 0 and 100');
      return;
    }

    setSaving(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const hashID = new ethers.Contract(
        CONTRACT_ADDRESSES.HASHD_TAG,
        HASHD_ID_ABI,
        signer
      );

      // Convert percentage to basis points (e.g., 2.5% = 250)
      const basisPoints = Math.round(percentageNum * 100);
      
      toast.info('Submitting transaction...');
      const tx = await hashID.setRoyalty(newRecipient, basisPoints);
      await tx.wait();
      
      toast.success('Royalty settings updated!');
      fetchRoyaltyInfo();
    } catch (error: any) {
      console.error('Error updating royalty:', error);
      toast.error(error.reason || 'Failed to update royalty');
    } finally {
      setSaving(false);
    }
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white">NFT Royalty Settings</h2>
        <p className="text-gray-400 text-sm">Configure ERC-2981 royalties for secondary marketplace sales</p>
      </div>

      {/* HashID NFT Royalty Configuration */}
      <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 border border-purple-600/50 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-purple-400 font-medium text-lg">HashID NFT Royalties</h3>
            <p className="text-gray-400 text-sm mt-1">Secondary sales on marketplaces (ERC-2981)</p>
          </div>
          <div className="text-right">
            <p className="text-white text-3xl font-bold">{currentPercentage}%</p>
            <p className="text-purple-300 text-xs mt-1">Current Rate</p>
          </div>
        </div>

        {!isOwner && (
          <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-3 text-yellow-400 text-sm mb-4">
            You are not the contract owner. Settings are view-only.
          </div>
        )}

        {/* Current Configuration */}
        <div className="bg-purple-900/20 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-purple-300 block mb-1">Current Recipient</span>
              <span className="text-white font-mono text-xs break-all">{currentRecipient}</span>
            </div>
            <div>
              <span className="text-sm text-purple-300 block mb-1">Example: 1 ETH Sale</span>
              <span className="text-white text-sm">→ {(currentPercentage / 100).toFixed(4)} ETH royalty</span>
            </div>
          </div>
        </div>

        {/* Update Form */}
        {isOwner && (
          <div>
          
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-purple-300 mb-1">Recipient Address</label>
                <input
                  type="text"
                  value={newRecipient}
                  onChange={(e) => setNewRecipient(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-3 py-2 bg-purple-900/30 border border-purple-600/50 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block text-sm text-purple-300 mb-1">Royalty Percentage</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={newPercentage}
                    onChange={(e) => setNewPercentage(e.target.value)}
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="2.5"
                    className="w-32 px-3 py-2 bg-purple-900/30 border border-purple-600/50 rounded-lg text-white focus:outline-none focus:border-purple-400"
                  />
                  <span className="text-purple-300">%</span>
                  <span className="text-xs text-purple-300/60">(Standard: 2.5% - 10%)</span>
                </div>
              </div>

              <button
                onClick={handleUpdateRoyalty}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
              >
                {saving ? (
                  <RefreshCw className="animate-spin" size={18} />
                ) : (
                  <Save size={18} />
                )}
                {saving ? 'Saving...' : 'Update HashID Royalty'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Group NFT Royalty Configuration */}
      <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 border border-green-600/50 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-green-400 font-medium text-lg">Group NFT Royalties</h3>
            <p className="text-gray-400 text-sm mt-1">Platform share from Group Prime Key sales (ERC-2981)</p>
          </div>
          <div className="text-right">
            <p className="text-white text-3xl font-bold">2.5%</p>
            <p className="text-green-300 text-xs mt-1">Platform Share</p>
            <p className="text-gray-400 text-xs">(7.5% total, 5% creator)</p>
          </div>
        </div>

        {!isOwner && (
          <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-3 text-yellow-400 text-sm mb-4">
            You are not the contract owner. Settings are view-only.
          </div>
        )}

        {/* Current Configuration */}
        <div className="bg-green-900/20 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-green-300 block mb-1">Current Platform Recipient</span>
              <span className="text-white font-mono text-xs break-all">0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266</span>
            </div>
            <div>
              <span className="text-sm text-green-300 block mb-1">Default Split Ratio</span>
              <span className="text-white text-sm">5% creator / 2.5% platform</span>
              <p className="text-xs text-green-300/60 mt-1">Platform owner can adjust per-group</p>
            </div>
          </div>
        </div>

        {/* Update Form */}
        {isOwner && (
          <div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-green-300 mb-1">Recipient Address</label>
                <input
                  type="text"
                  placeholder="0x..."
                  className="w-full px-3 py-2 bg-green-900/30 border border-green-600/50 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-green-400"
                />
                <p className="text-xs text-green-300/60 mt-1">Where the 2.5% platform royalty will be sent</p>
              </div>

              <button
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
              >
                {saving ? (
                  <RefreshCw className="animate-spin" size={18} />
                ) : (
                  <Save size={18} />
                )}
                {saving ? 'Saving...' : 'Update Group NFT Royalty'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-4">
        <h4 className="text-blue-400 font-medium mb-2">About NFT Royalties</h4>
        <p className="text-gray-400 text-sm mb-2">
          <strong>ERC-2981 Standard:</strong> When an NFT is sold on a compatible marketplace,
          the specified percentage of the sale price is automatically sent to the recipient address.
        </p>
        <p className="text-gray-400 text-sm">
          <strong>Group NFTs:</strong> 7.5% total royalty split: 5% to group creator, 2.5% to platform.
          The platform share goes to the configured recipient address.
        </p>
      </div>
    </div>
  );
};

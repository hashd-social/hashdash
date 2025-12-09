import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { Percent, Save, RefreshCw } from 'lucide-react';
import { useToast } from '../Toast';
import { CONTRACT_ADDRESSES, HASHD_TAG_ABI } from '../../config/contracts';

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
      const hashdTag = new ethers.Contract(
        CONTRACT_ADDRESSES.HASHD_TAG,
        HASHD_TAG_ABI,
        provider
      );

      // Check ownership
      const owner = await hashdTag.owner();
      setIsOwner(owner.toLowerCase() === userAddress.toLowerCase());

      // Get royalty info (use tokenId 1 and 1 ETH as reference)
      const salePrice = ethers.parseEther('1');
      const [recipient, royaltyAmount] = await hashdTag.royaltyInfo(1, salePrice);
      
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
  }, [userAddress, toast]);

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
      const hashdTag = new ethers.Contract(
        CONTRACT_ADDRESSES.HASHD_TAG,
        HASHD_TAG_ABI,
        signer
      );

      // Convert percentage to basis points (e.g., 2.5% = 250)
      const basisPoints = Math.round(percentageNum * 100);
      
      toast.info('Submitting transaction...');
      const tx = await hashdTag.setRoyalty(newRecipient, basisPoints);
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
        <p className="text-gray-400 text-sm">Configure ERC-2981 royalties for HashdTag NFT sales</p>
      </div>

      {!isOwner && (
        <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4 text-yellow-400">
          You are not the contract owner. Royalty settings are view-only.
        </div>
      )}

      {/* Current Settings */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
          <Percent size={20} className="text-cyan-400" />
          Current Royalty Configuration
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-700/50 rounded-lg p-4">
            <span className="text-sm text-gray-400 block mb-1">Recipient Address</span>
            <span className="text-white font-mono text-sm break-all">{currentRecipient}</span>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-4">
            <span className="text-sm text-gray-400 block mb-1">Royalty Percentage</span>
            <span className="text-white text-2xl font-bold">{currentPercentage}%</span>
            <span className="text-gray-500 text-sm ml-2">({Math.round(currentPercentage * 100)} basis points)</span>
          </div>
        </div>

        {/* Example calculation */}
        <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-600">
          <span className="text-sm text-gray-400 block mb-2">Example Calculation</span>
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-gray-500">Sale Price:</span>
              <span className="text-white ml-2">1 ETH</span>
            </div>
            <span className="text-gray-600">→</span>
            <div>
              <span className="text-gray-500">Royalty:</span>
              <span className="text-cyan-400 ml-2">{(currentPercentage / 100).toFixed(4)} ETH</span>
            </div>
          </div>
        </div>
      </div>

      {/* Update Form */}
      {isOwner && (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-medium text-white mb-4">Update Royalty Settings</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Recipient Address</label>
              <input
                type="text"
                value={newRecipient}
                onChange={(e) => setNewRecipient(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
              />
              <p className="text-xs text-gray-500 mt-1">Address that will receive royalty payments</p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Royalty Percentage</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={newPercentage}
                  onChange={(e) => setNewPercentage(e.target.value)}
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="2.5"
                  className="w-32 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                />
                <span className="text-gray-400">%</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Standard marketplace royalty is 2.5% - 10%</p>
            </div>

            <button
              onClick={handleUpdateRoyalty}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
            >
              {saving ? (
                <RefreshCw className="animate-spin" size={18} />
              ) : (
                <Save size={18} />
              )}
              {saving ? 'Saving...' : 'Update Royalty'}
            </button>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-4">
        <h4 className="text-blue-400 font-medium mb-2">About ERC-2981 Royalties</h4>
        <p className="text-gray-400 text-sm">
          ERC-2981 is a standard for NFT royalties. When a HashdTag NFT is sold on a compatible marketplace,
          the specified percentage of the sale price is automatically sent to the recipient address.
          Note: Not all marketplaces enforce on-chain royalties.
        </p>
      </div>
    </div>
  );
};

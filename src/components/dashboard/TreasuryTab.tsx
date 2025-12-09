import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { Wallet, ArrowDownToLine, RefreshCw } from 'lucide-react';
import { useToast } from '../Toast';
import { CONTRACT_ADDRESSES, ACCOUNT_REGISTRY_ABI, HASHD_TAG_ABI } from '../../config/contracts';

interface TreasuryTabProps {
  userAddress: string;
}

interface ContractBalance {
  name: string;
  address: string;
  balance: bigint;
  canWithdraw: boolean;
}

export const TreasuryTab: React.FC<TreasuryTabProps> = ({ userAddress }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState<ContractBalance[]>([]);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);

  const fetchBalances = useCallback(async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contractBalances: ContractBalance[] = [];

      // Check AccountRegistry
      if (CONTRACT_ADDRESSES.ACCOUNT_REGISTRY) {
        const accountRegistry = new ethers.Contract(
          CONTRACT_ADDRESSES.ACCOUNT_REGISTRY,
          ACCOUNT_REGISTRY_ABI,
          provider
        );
        const balance = await provider.getBalance(CONTRACT_ADDRESSES.ACCOUNT_REGISTRY);
        const owner = await accountRegistry.owner();
        contractBalances.push({
          name: 'AccountRegistry',
          address: CONTRACT_ADDRESSES.ACCOUNT_REGISTRY,
          balance,
          canWithdraw: owner.toLowerCase() === userAddress.toLowerCase(),
        });
      }

      // Check HashdTag
      if (CONTRACT_ADDRESSES.HASHD_TAG) {
        const hashdTag = new ethers.Contract(
          CONTRACT_ADDRESSES.HASHD_TAG,
          HASHD_TAG_ABI,
          provider
        );
        const balance = await provider.getBalance(CONTRACT_ADDRESSES.HASHD_TAG);
        const owner = await hashdTag.owner();
        contractBalances.push({
          name: 'HashdTag',
          address: CONTRACT_ADDRESSES.HASHD_TAG,
          balance,
          canWithdraw: owner.toLowerCase() === userAddress.toLowerCase(),
        });
      }

      setBalances(contractBalances);
    } catch (error) {
      console.error('Error fetching balances:', error);
      toast.error('Failed to fetch contract balances');
    } finally {
      setLoading(false);
    }
  }, [userAddress, toast]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  const handleWithdraw = async (contractName: string) => {
    setWithdrawing(contractName);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      let contract: ethers.Contract;
      if (contractName === 'AccountRegistry') {
        contract = new ethers.Contract(
          CONTRACT_ADDRESSES.ACCOUNT_REGISTRY,
          ACCOUNT_REGISTRY_ABI,
          signer
        );
      } else {
        contract = new ethers.Contract(
          CONTRACT_ADDRESSES.HASHD_TAG,
          HASHD_TAG_ABI,
          signer
        );
      }

      toast.info('Submitting withdrawal transaction...');
      const tx = await contract.withdrawFees();
      await tx.wait();
      
      toast.success(`Fees withdrawn from ${contractName}!`);
      fetchBalances();
    } catch (error: any) {
      console.error('Error withdrawing:', error);
      toast.error(error.reason || 'Failed to withdraw fees');
    } finally {
      setWithdrawing(null);
    }
  };

  const totalBalance = balances.reduce((sum, b) => sum + b.balance, BigInt(0));
  const canWithdrawAny = balances.some(b => b.canWithdraw && b.balance > BigInt(0));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="animate-spin text-cyan-400" size={32} />
      </div>
    );
  }

  if (balances.length === 0) {
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
        <h2 className="text-xl font-semibold text-white">Treasury Management</h2>
        <p className="text-gray-400 text-sm">View and withdraw collected fees from contracts</p>
      </div>

      {/* Total Balance Card */}
      <div className="bg-gradient-to-r from-cyan-900/50 to-purple-900/50 rounded-lg p-6 border border-cyan-700">
        <div className="flex items-center gap-3 mb-2">
          <Wallet className="text-cyan-400" size={24} />
          <span className="text-gray-400">Total Contract Balance</span>
        </div>
        <div className="text-3xl font-bold text-white">
          {ethers.formatEther(totalBalance)} ETH
        </div>
      </div>

      {/* Individual Contract Balances */}
      <div className="space-y-4">
        {balances.map((contract) => (
          <div key={contract.name} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-white">{contract.name}</h3>
                <p className="text-sm text-gray-500 font-mono">{contract.address}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-white">
                  {ethers.formatEther(contract.balance)} ETH
                </div>
                {contract.canWithdraw && contract.balance > BigInt(0) && (
                  <button
                    onClick={() => handleWithdraw(contract.name)}
                    disabled={withdrawing === contract.name}
                    className="mt-2 flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                  >
                    {withdrawing === contract.name ? (
                      <RefreshCw className="animate-spin" size={16} />
                    ) : (
                      <ArrowDownToLine size={16} />
                    )}
                    {withdrawing === contract.name ? 'Withdrawing...' : 'Withdraw'}
                  </button>
                )}
                {!contract.canWithdraw && (
                  <span className="text-xs text-gray-500">Not owner</span>
                )}
                {contract.canWithdraw && contract.balance === BigInt(0) && (
                  <span className="text-xs text-gray-500">No fees to withdraw</span>
                )}
              </div>
            </div>

            {/* Fee Sources */}
            <div className="mt-4 pt-4 border-t border-gray-700">
              <span className="text-sm text-gray-400">Fee Sources:</span>
              <ul className="mt-1 text-sm text-gray-500">
                {contract.name === 'AccountRegistry' && (
                  <>
                    <li>• HashdTag registration fees (via registerAccountWithHashdTag)</li>
                    <li>• Domain-based tier pricing</li>
                  </>
                )}
                {contract.name === 'HashdTag' && (
                  <>
                    <li>• Direct minting fees (via mintDirect)</li>
                    <li>• NFT-only purchases without account creation</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* Withdraw All */}
      {canWithdrawAny && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">
            💡 Tip: Withdraw fees regularly to your wallet. Fees accumulate from HashdTag registrations
            and direct NFT mints.
          </p>
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-4">
        <h4 className="text-blue-400 font-medium mb-2">Fee Collection</h4>
        <p className="text-gray-400 text-sm">
          Fees are collected from two sources:
        </p>
        <ul className="text-gray-400 text-sm mt-2 space-y-1">
          <li><strong>AccountRegistry:</strong> Collects fees when users register accounts with HashdTags (name@domain)</li>
          <li><strong>HashdTag:</strong> Collects fees when users mint HashdTag NFTs directly without creating an account</li>
        </ul>
      </div>
    </div>
  );
};

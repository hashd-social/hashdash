import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { Wallet, ArrowDownToLine, RefreshCw, TrendingUp, DollarSign, Package } from 'lucide-react';
import { useToast } from '../Toast';
import { CONTRACT_ADDRESSES } from '../../config/contracts';

interface TreasuryTabProps {
  userAddress: string;
}

interface RevenueData {
  totalBalance: bigint;
  totalAllTime: bigint;
  totalWithdrawn: bigint;
  
  registrationCurrent: bigint;
  registrationAllTime: bigint;
  registrationWithdrawn: bigint;
  
  directMintCurrent: bigint;
  directMintAllTime: bigint;
  directMintWithdrawn: bigint;
  
  groupPrimaryCurrent: bigint;
  groupPrimaryAllTime: bigint;
  groupPrimaryWithdrawn: bigint;
  
  nftRoyaltiesCurrent: bigint;
  nftRoyaltiesAllTime: bigint;
  nftRoyaltiesWithdrawn: bigint;
}

const PLATFORM_TREASURY_ABI = [
  "function getRevenueReport() view returns (uint256 totalBalance, uint256 totalAllTime, uint256 totalWithdrawnAmount, uint256 registrationCurrent, uint256 registrationAllTime, uint256 registrationWithdrawn, uint256 directMintCurrent, uint256 directMintAllTime, uint256 directMintWithdrawn, uint256 groupPrimaryCurrent, uint256 groupPrimaryAllTime, uint256 groupPrimaryWithdrawn, uint256 nftRoyaltiesCurrent, uint256 nftRoyaltiesAllTime, uint256 nftRoyaltiesWithdrawn)",
  "function withdraw() external",
  "function withdrawAmount(uint256 amount) external",
  "function owner() view returns (address)",
  "function withdrawalRecipient() view returns (address)"
];

export const TreasuryTab: React.FC<TreasuryTabProps> = ({ userAddress }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const fetchTreasuryData = useCallback(async () => {
    if (!CONTRACT_ADDRESSES.PLATFORM_TREASURY) {
      setLoading(false);
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const treasury = new ethers.Contract(
        CONTRACT_ADDRESSES.PLATFORM_TREASURY,
        PLATFORM_TREASURY_ABI,
        provider
      );

      const owner = await treasury.owner();
      setIsOwner(owner.toLowerCase() === userAddress.toLowerCase());

      const report = await treasury.getRevenueReport();
      
      setRevenueData({
        totalBalance: report.totalBalance,
        totalAllTime: report.totalAllTime,
        totalWithdrawn: report.totalWithdrawnAmount,
        registrationCurrent: report.registrationCurrent,
        registrationAllTime: report.registrationAllTime,
        registrationWithdrawn: report.registrationWithdrawn,
        directMintCurrent: report.directMintCurrent,
        directMintAllTime: report.directMintAllTime,
        directMintWithdrawn: report.directMintWithdrawn,
        groupPrimaryCurrent: report.groupPrimaryCurrent,
        groupPrimaryAllTime: report.groupPrimaryAllTime,
        groupPrimaryWithdrawn: report.groupPrimaryWithdrawn,
        nftRoyaltiesCurrent: report.nftRoyaltiesCurrent,
        nftRoyaltiesAllTime: report.nftRoyaltiesAllTime,
        nftRoyaltiesWithdrawn: report.nftRoyaltiesWithdrawn,
      });
    } catch (error) {
      console.error('Error fetching treasury data:', error);
      toast.error('Failed to fetch treasury data');
    } finally {
      setLoading(false);
    }
  }, [userAddress, toast]);

  useEffect(() => {
    fetchTreasuryData();
  }, [fetchTreasuryData]);

  const handleWithdraw = async () => {
    if (!CONTRACT_ADDRESSES.PLATFORM_TREASURY) return;

    setWithdrawing(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const treasury = new ethers.Contract(
        CONTRACT_ADDRESSES.PLATFORM_TREASURY,
        PLATFORM_TREASURY_ABI,
        signer
      );

      toast.info('Submitting withdrawal transaction...');
      const tx = await treasury.withdraw();
      await tx.wait();
      
      toast.success('All funds withdrawn from treasury!');
      fetchTreasuryData();
    } catch (error: any) {
      console.error('Error withdrawing:', error);
      toast.error(error.reason || 'Failed to withdraw funds');
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="animate-spin text-cyan-400" size={32} />
      </div>
    );
  }

  console.log(CONTRACT_ADDRESSES)

  if (!CONTRACT_ADDRESSES.PLATFORM_TREASURY) {
    return (
      <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4 text-yellow-400">
        Platform Treasury not configured. Run the start-all script to deploy contracts.
      </div>
    );
  }

  // Show 0 balances if no revenue data yet
  const displayData = revenueData || {
    totalBalance: BigInt(0),
    totalAllTime: BigInt(0),
    totalWithdrawn: BigInt(0),
    registrationCurrent: BigInt(0),
    registrationAllTime: BigInt(0),
    registrationWithdrawn: BigInt(0),
    directMintCurrent: BigInt(0),
    directMintAllTime: BigInt(0),
    directMintWithdrawn: BigInt(0),
    groupPrimaryCurrent: BigInt(0),
    groupPrimaryAllTime: BigInt(0),
    groupPrimaryWithdrawn: BigInt(0),
    nftRoyaltiesCurrent: BigInt(0),
    nftRoyaltiesAllTime: BigInt(0),
    nftRoyaltiesWithdrawn: BigInt(0),
  };

  const RevenueCard = ({ 
    title, 
    description, 
    icon: Icon, 
    color, 
    current, 
    allTime, 
    withdrawn 
  }: { 
    title: string; 
    description: string; 
    icon: any; 
    color: string; 
    current: bigint; 
    allTime: bigint; 
    withdrawn: bigint;
  }) => (
    <div className={`bg-gradient-to-br ${color} border rounded-lg p-6`}>
      <div className="flex items-center gap-3 mb-4">
        <Icon className="text-white" size={24} />
        <div>
          <h3 className="text-white font-medium text-lg">{title}</h3>
          <p className="text-gray-300 text-xs">{description}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-gray-300 mb-1">Current</p>
          <p className="text-white font-bold">{ethers.formatEther(current)} ETH</p>
        </div>
        <div>
          <p className="text-xs text-gray-300 mb-1">All-Time</p>
          <p className="text-white font-bold">{ethers.formatEther(allTime)} ETH</p>
        </div>
        <div>
          <p className="text-xs text-gray-300 mb-1">Withdrawn</p>
          <p className="text-white font-bold">{ethers.formatEther(withdrawn)} ETH</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white">Platform Treasury</h2>
        <p className="text-gray-400 text-sm">Unified revenue tracking across all platform streams</p>
      </div>

      {!isOwner && (
        <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-3 text-yellow-400 text-sm">
          You are not the treasury owner. View-only mode.
        </div>
      )}

      {/* Total Balance Card */}
      <div className="bg-gradient-to-r from-cyan-900/50 to-purple-900/50 rounded-lg p-6 border border-cyan-700">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Wallet className="text-cyan-400" size={28} />
              <span className="text-gray-300 text-lg">Total Treasury Balance</span>
            </div>
            <div className="text-4xl font-bold text-white mb-2">
              {ethers.formatEther(displayData.totalBalance)} ETH
            </div>
            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-gray-400">All-Time: </span>
                <span className="text-cyan-300 font-medium">{ethers.formatEther(displayData.totalAllTime)} ETH</span>
              </div>
              <div>
                <span className="text-gray-400">Withdrawn: </span>
                <span className="text-purple-300 font-medium">{ethers.formatEther(displayData.totalWithdrawn)} ETH</span>
              </div>
            </div>
          </div>
          
          {isOwner && displayData.totalBalance > BigInt(0) && (
            <button
              onClick={handleWithdraw}
              disabled={withdrawing}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg transition-colors font-medium"
            >
              {withdrawing ? (
                <>
                  <RefreshCw className="animate-spin" size={20} />
                  Withdrawing...
                </>
              ) : (
                <>
                  <ArrowDownToLine size={20} />
                  Withdraw All
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Revenue Sources Header */}
      <div className="flex items-center gap-2 mt-8">
        <TrendingUp className="text-cyan-400" size={20} />
        <h3 className="text-lg font-semibold text-white">Revenue Sources</h3>
      </div>

      {/* Primary Revenue Sources */}
      <div>
        <h4 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">Primary Sales</h4>
        <div className="space-y-4">
          <RevenueCard
            title="HashID Registration"
            description="Account registration with HashID (name@domain)"
            icon={DollarSign}
            color="from-blue-900/30 to-blue-800/20 border-blue-600/50"
            current={displayData.registrationCurrent}
            allTime={displayData.registrationAllTime}
            withdrawn={displayData.registrationWithdrawn}
          />
          
          <RevenueCard
            title="HashID Direct Mint"
            description="Direct NFT minting via mintDirect()"
            icon={Package}
            color="from-purple-900/30 to-purple-800/20 border-purple-600/50"
            current={displayData.directMintCurrent}
            allTime={displayData.directMintAllTime}
            withdrawn={displayData.directMintWithdrawn}
          />
          
          <RevenueCard
            title="Group NFT Primary Fees"
            description="Platform share from Group Prime Key mints (2.5%)"
            icon={Package}
            color="from-green-900/30 to-green-800/20 border-green-600/50"
            current={displayData.groupPrimaryCurrent}
            allTime={displayData.groupPrimaryAllTime}
            withdrawn={displayData.groupPrimaryWithdrawn}
          />
        </div>
      </div>

      {/* Secondary Revenue (Royalties) */}
      <div>
        <h4 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">Secondary Sales (ERC-2981 Royalties)</h4>
        <RevenueCard
          title="NFT Marketplace Royalties"
          description="Combined HashID + Group NFT secondary sales (OpenSea, Blur, etc.)"
          icon={TrendingUp}
          color="from-orange-900/30 to-orange-800/20 border-orange-600/50"
          current={displayData.nftRoyaltiesCurrent}
          allTime={displayData.nftRoyaltiesAllTime}
          withdrawn={displayData.nftRoyaltiesWithdrawn}
        />
      </div>

      {/* Info Box */}
      <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-4">
        <h4 className="text-blue-400 font-medium mb-2">About Platform Treasury</h4>
        <div className="text-gray-400 text-sm space-y-2">
          <p>
            <strong>Unified Revenue:</strong> All platform revenue streams are automatically forwarded to the PlatformTreasury contract for centralized tracking and withdrawal.
          </p>
          <p>
            <strong>Primary Sales:</strong> Direct fees from HashID registrations, direct mints, and Group NFT purchases.
          </p>
          <p>
            <strong>Secondary Royalties:</strong> Marketplace royalties from NFT resales are sent via ERC-2981 standard. Since marketplaces don't identify the collection, HashID and Group NFT royalties are tracked together.
          </p>
          <p>
            <strong>Withdrawal:</strong> Treasury owner can withdraw all accumulated funds at once. Balances are tracked separately but withdrawn together.
          </p>
        </div>
      </div>
    </div>
  );
};

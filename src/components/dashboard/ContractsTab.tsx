import React from 'react';
import { FileCode, ExternalLink, Copy, Check, Database, Cpu, Coins } from 'lucide-react';
import { useToast } from '../Toast';
import { getAllContractInfo, NETWORK_CONFIG, ContractInfo } from '../../config/contracts';
import { ContractExplorer } from './ContractExplorer';

interface ContractsTabProps {
  userAddress: string;
}

export const ContractsTab: React.FC<ContractsTabProps> = ({ userAddress }) => {
  const toast = useToast();
  const [copiedAddress, setCopiedAddress] = React.useState<string | null>(null);
  const [selectedContract, setSelectedContract] = React.useState<ContractInfo | null>(null);
  
  const contracts = getAllContractInfo();
  const tokenContracts = contracts.filter(c => c.type === 'token');
  const storageContracts = contracts.filter(c => c.type === 'storage');
  const logicContracts = contracts.filter(c => c.type === 'logic');

  const copyToClipboard = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      toast.success('Address copied!');
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 10)}...${address.slice(-8)}`;
  };

  const ContractCard: React.FC<{ contract: ContractInfo }> = ({ contract }) => (
    <div 
      onClick={() => setSelectedContract(contract)}
      className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-cyan-500/50 transition-all cursor-pointer group"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {contract.type === 'token' ? (
            <Coins size={18} className="text-yellow-400" />
          ) : contract.type === 'storage' ? (
            <Database size={18} className="text-purple-400" />
          ) : (
            <Cpu size={18} className="text-cyan-400" />
          )}
          <span className="text-white font-medium group-hover:text-cyan-400 transition-colors">{contract.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              copyToClipboard(contract.address);
            }}
            className="p-1.5 text-gray-400 hover:text-white transition-colors"
            title="Copy address"
          >
            {copiedAddress === contract.address ? (
              <Check size={16} className="text-green-400" />
            ) : (
              <Copy size={16} />
            )}
          </button>
          {NETWORK_CONFIG.CHAIN_ID !== 31337 && (
            <a
              href={`https://explorer.megaeth.com/address/${contract.address}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
              title="View on explorer"
            >
              <ExternalLink size={16} />
            </a>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <code className="text-sm text-gray-400 font-mono">{truncateAddress(contract.address)}</code>
        <span className="text-xs text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
          Click to explore →
        </span>
      </div>
    </div>
  );

  // Show explorer view if a contract is selected
  if (selectedContract) {
    return (
      <ContractExplorer
        contract={selectedContract}
        onBack={() => setSelectedContract(null)}
        userAddress={userAddress}
      />
    );
  }

  if (contracts.length === 0) {
    return (
      <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4 text-yellow-400">
        <FileCode className="inline mr-2" size={18} />
        No contract addresses configured. Run the start-all script to deploy contracts.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white">Deployed Contracts</h2>
        <p className="text-gray-400 text-sm">All smart contracts deployed in this environment</p>
      </div>

      {/* Network Info */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-sm text-gray-400">Network</span>
            <p className="text-white font-medium">
              {NETWORK_CONFIG.CHAIN_ID === 31337 ? 'Local Hardhat' : `Chain ID: ${NETWORK_CONFIG.CHAIN_ID}`}
            </p>
          </div>
          <div className="border-l border-gray-700 pl-4">
            <span className="text-sm text-gray-400">RPC URL</span>
            <p className="text-white font-mono text-sm">{NETWORK_CONFIG.RPC_URL}</p>
          </div>
          <div className="border-l border-gray-700 pl-4">
            <span className="text-sm text-gray-400">Total Contracts</span>
            <p className="text-white font-medium">{contracts.length}</p>
          </div>
        </div>
      </div>

      {/* Token Contracts */}
      {tokenContracts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Coins size={20} className="text-yellow-400" />
            <h3 className="text-lg font-medium text-white">Token Contracts</h3>
            <span className="text-sm text-gray-500">({tokenContracts.length})</span>
          </div>
          <p className="text-gray-400 text-sm mb-4">
            ERC20 utility tokens used for staking, rewards, and governance.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tokenContracts.map((contract) => (
              <ContractCard key={contract.name} contract={contract} />
            ))}
          </div>
        </div>
      )}

      {/* Storage Contracts */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Database size={20} className="text-purple-400" />
          <h3 className="text-lg font-medium text-white">Storage Contracts (Eternal)</h3>
          <span className="text-sm text-gray-500">({storageContracts.length})</span>
        </div>
        <p className="text-gray-400 text-sm mb-4">
          These contracts store persistent data and are never redeployed. Logic contracts are upgraded separately.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {storageContracts.map((contract) => (
            <ContractCard key={contract.name} contract={contract} />
          ))}
        </div>
      </div>

      {/* Logic Contracts */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Cpu size={20} className="text-cyan-400" />
          <h3 className="text-lg font-medium text-white">Logic Contracts (Upgradeable)</h3>
          <span className="text-sm text-gray-500">({logicContracts.length})</span>
        </div>
        <p className="text-gray-400 text-sm mb-4">
          These contracts contain business logic and can be upgraded without losing data.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {logicContracts.map((contract) => (
            <ContractCard key={contract.name} contract={contract} />
          ))}
        </div>
      </div>

      {/* All Addresses (copyable) */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h4 className="text-white font-medium mb-3">All Contract Addresses</h4>
        <div className="bg-gray-900 rounded p-3 font-mono text-xs overflow-x-auto">
          {contracts.map((c) => (
            <div key={c.name} className="flex justify-between py-1 border-b border-gray-800 last:border-0">
              <span className="text-gray-400">{c.name}:</span>
              <span className="text-cyan-400">{c.address}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => {
            const text = contracts.map(c => `${c.name}: ${c.address}`).join('\n');
            navigator.clipboard.writeText(text);
            toast.success('All addresses copied!');
          }}
          className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
        >
          <Copy size={14} />
          Copy All
        </button>
      </div>
    </div>
  );
};

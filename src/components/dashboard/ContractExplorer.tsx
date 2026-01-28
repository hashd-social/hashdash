import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, FileCode, Eye, Edit, AlertCircle } from 'lucide-react';
import { ethers } from 'ethers';
import { useToast } from '../Toast';
import { ContractInfo } from '../../config/contracts';
import { CONTRACT_ABIS } from '../../abis';

interface ContractExplorerProps {
  contract: ContractInfo;
  onBack: () => void;
  userAddress: string;
}

interface FunctionABI {
  name: string;
  type: string;
  stateMutability: string;
  inputs: Array<{
    name: string;
    type: string;
  }>;
  outputs: Array<{
    name: string;
    type: string;
  }>;
}

// FunctionCard component defined outside to prevent re-creation on every render
const FunctionCard: React.FC<{ 
  func: FunctionABI; 
  isWrite: boolean;
  functionInputs: { [key: string]: any };
  executingFunction: string | null;
  functionResults: { [key: string]: any };
  onInputChange: (functionName: string, index: number, value: string) => void;
  onExecute: (func: FunctionABI, isWrite: boolean) => void;
}> = ({ func, isWrite, functionInputs, executingFunction, functionResults, onInputChange, onExecute }) => (
  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        {isWrite ? (
          <Edit size={16} className="text-orange-400" />
        ) : (
          <Eye size={16} className="text-cyan-400" />
        )}
        <span className="text-white font-mono font-medium">{func.name}</span>
      </div>
      {func.stateMutability === 'payable' && (
        <span className="text-xs bg-yellow-900/50 text-yellow-400 px-2 py-1 rounded">
          Payable
        </span>
      )}
    </div>

    {func.inputs.length > 0 && (
      <div className="space-y-2 mb-3">
        {func.inputs.map((input, index) => (
          <div key={index}>
            <label className="text-xs text-gray-400 mb-1 block">
              {input.name || `param${index}`} <span className="text-gray-500">({input.type})</span>
            </label>
            <input
              type="text"
              value={functionInputs[func.name]?.[index] || ''}
              onChange={(e) => onInputChange(func.name, index, e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:border-cyan-500 focus:outline-none"
              placeholder={`Enter ${input.type}`}
            />
          </div>
        ))}
      </div>
    )}

    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onExecute(func, isWrite);
      }}
      disabled={executingFunction === func.name}
      className={`w-full px-4 py-2 rounded text-sm font-medium transition-colors ${
        isWrite
          ? 'bg-orange-600 hover:bg-orange-700 text-white'
          : 'bg-cyan-600 hover:bg-cyan-700 text-white'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {executingFunction === func.name ? 'Executing...' : isWrite ? 'Write' : 'Query'}
    </button>

    {functionResults[func.name] && (
      <div className="mt-3 p-3 bg-gray-900 rounded border border-gray-700">
        <div className="text-xs text-gray-400 mb-1">Result:</div>
        <div className="text-sm text-green-400 font-mono break-all">
          {functionResults[func.name]}
        </div>
      </div>
    )}
  </div>
);

export const ContractExplorer: React.FC<ContractExplorerProps> = ({ contract, onBack, userAddress }) => {
  const toast = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [abi, setAbi] = useState<FunctionABI[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'read' | 'write'>('read');
  const [functionInputs, setFunctionInputs] = useState<{ [key: string]: any }>({});
  const [functionResults, setFunctionResults] = useState<{ [key: string]: any }>({});
  const [executingFunction, setExecutingFunction] = useState<string | null>(null);

  useEffect(() => {
    loadContractABI();
  }, [contract]);

  const loadContractABI = async () => {
    try {
      setLoading(true);
      
      // Check if contract has no ABI available
      if (contract.contractName === null) {
        console.log(`[ContractExplorer] Contract ${contract.name} marked as no ABI (contractName is null)`);
        setAbi([]);
        setLoading(false);
        return;
      }
      
      // Load ABI from imported modules
      // Use contractName if available (for display name mappings), otherwise use name
      const abiKey = contract.contractName || contract.name;
      console.log(`[ContractExplorer] Loading ABI for ${contract.name}, using key: ${abiKey}`);
      console.log('[ContractExplorer] Available ABI keys:', Object.keys(CONTRACT_ABIS));
      
      const artifact = CONTRACT_ABIS[abiKey];
      
      if (!artifact) {
        throw new Error(`No ABI found for contract: ${contract.name} (looking for: ${abiKey})`);
      }
      
      const functions = artifact.abi.filter((item: any) => item.type === 'function');
      console.log(`[ContractExplorer] Loaded ${functions.length} functions for ${contract.name}`);
      setAbi(functions);
    } catch (error) {
      console.error('Error loading ABI:', error);
      toast.error(`Failed to load contract ABI for ${contract.name}`);
      setAbi([]);
    } finally {
      setLoading(false);
    }
  };

  const readFunctions = abi.filter(f => 
    f.stateMutability === 'view' || f.stateMutability === 'pure'
  );

  const writeFunctions = abi.filter(f => 
    f.stateMutability !== 'view' && f.stateMutability !== 'pure'
  );

  const handleInputChange = (functionName: string, index: number, value: string) => {
    setFunctionInputs(prev => {
      const newInputs = { ...prev };
      if (!newInputs[functionName]) {
        newInputs[functionName] = {};
      }
      newInputs[functionName] = {
        ...newInputs[functionName],
        [index]: value
      };
      return newInputs;
    });
  };

  const executeReadFunction = async (func: FunctionABI) => {
    try {
      setExecutingFunction(func.name);
      
      if (!window.ethereum) {
        throw new Error('MetaMask not found');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const contractInstance = new ethers.Contract(contract.address, [func], provider);
      
      const inputs = func.inputs.map((_, index) => 
        functionInputs[func.name]?.[index] || ''
      );

      const result = await contractInstance[func.name](...inputs);
      
      setFunctionResults(prev => ({
        ...prev,
        [func.name]: result.toString()
      }));
      
      toast.success('Function executed successfully');
    } catch (error: any) {
      console.error('Error executing function:', error);
      toast.error(error.message || 'Failed to execute function');
    } finally {
      setExecutingFunction(null);
    }
  };

  const executeWriteFunction = async (func: FunctionABI) => {
    try {
      setExecutingFunction(func.name);
      
      if (!window.ethereum) {
        throw new Error('MetaMask not found');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contractInstance = new ethers.Contract(contract.address, [func], signer);
      
      const inputs = func.inputs.map((_, index) => 
        functionInputs[func.name]?.[index] || ''
      );

      const tx = await contractInstance[func.name](...inputs);
      toast.info('Transaction sent, waiting for confirmation...');
      
      await tx.wait();
      toast.success('Transaction confirmed!');
      
      setFunctionResults(prev => ({
        ...prev,
        [func.name]: `Transaction hash: ${tx.hash}`
      }));
    } catch (error: any) {
      console.error('Error executing function:', error);
      toast.error(error.message || 'Failed to execute function');
    } finally {
      setExecutingFunction(null);
    }
  };

  const handleExecute = (func: FunctionABI, isWrite: boolean) => {
    if (isWrite) {
      executeWriteFunction(func);
    } else {
      executeReadFunction(func);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-400">Loading contract ABI...</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Header */}
      <div>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 mb-4 transition-colors"
        >
          <ArrowLeft size={18} />
          Back to Contracts
        </button>
        
        <div className="flex items-center gap-3 mb-2">
          <FileCode size={24} className="text-cyan-400" />
          <h2 className="text-2xl font-semibold text-white">{contract.name}</h2>
        </div>
        
        <div className="flex items-center gap-4 text-sm">
          <code className="text-gray-400 font-mono">{contract.address}</code>
          <span className="text-gray-500">|</span>
          <span className="text-gray-400">{abi.length} functions</span>
        </div>
      </div>

      {abi.length === 0 ? (
        <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4 text-yellow-400 flex items-start gap-3">
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium mb-1">No ABI Available</div>
            <div className="text-sm">
              {contract.contractName === null 
                ? `This ${contract.type} contract doesn't have a separate ABI. Storage contracts are typically accessed through their associated logic contracts.`
                : 'Unable to load contract ABI. Make sure the contract is compiled and artifacts are available.'
              }
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="border-b border-gray-700">
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setActiveTab('read')}
                className={`pb-3 px-1 font-medium transition-colors ${
                  activeTab === 'read'
                    ? 'text-cyan-400 border-b-2 border-cyan-400'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Eye size={16} />
                  Read Functions ({readFunctions.length})
                </div>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('write')}
                className={`pb-3 px-1 font-medium transition-colors ${
                  activeTab === 'write'
                    ? 'text-orange-400 border-b-2 border-orange-400'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Edit size={16} />
                  Write Functions ({writeFunctions.length})
                </div>
              </button>
            </div>
          </div>

          {/* Function List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeTab === 'read' ? (
              readFunctions.length > 0 ? (
                readFunctions.map((func) => (
                  <FunctionCard 
                    key={func.name} 
                    func={func} 
                    isWrite={false}
                    functionInputs={functionInputs}
                    executingFunction={executingFunction}
                    functionResults={functionResults}
                    onInputChange={handleInputChange}
                    onExecute={handleExecute}
                  />
                ))
              ) : (
                <div className="col-span-2 text-center py-8 text-gray-400">
                  No read functions available
                </div>
              )
            ) : (
              writeFunctions.length > 0 ? (
                writeFunctions.map((func) => (
                  <FunctionCard 
                    key={func.name} 
                    func={func} 
                    isWrite={true}
                    functionInputs={functionInputs}
                    executingFunction={executingFunction}
                    functionResults={functionResults}
                    onInputChange={handleInputChange}
                    onExecute={handleExecute}
                  />
                ))
              ) : (
                <div className="col-span-2 text-center py-8 text-gray-400">
                  No write functions available
                </div>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
};

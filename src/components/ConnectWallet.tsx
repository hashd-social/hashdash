import React, { useState } from 'react';
import { Wallet } from 'lucide-react';

interface ConnectWalletProps {
  onConnect: (address: string) => void;
}

declare global {
  interface Window {
    ethereum?: any;
  }
}

const CHAIN_ID = parseInt(process.env.REACT_APP_CHAIN_ID || '31337');
const RPC_URL = process.env.REACT_APP_RPC_URL || 'http://127.0.0.1:8545';

export const ConnectWallet: React.FC<ConnectWalletProps> = ({ onConnect }) => {
  const [isConnecting, setIsConnecting] = useState(false);

  const switchNetwork = async () => {
    if (!window.ethereum) return;
    
    const chainIdHex = `0x${CHAIN_ID.toString(16)}`;
    
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      });
    } catch (switchError: any) {
      // If network doesn't exist, add it
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: chainIdHex,
            chainName: 'Localhost',
            rpcUrls: [RPC_URL],
            nativeCurrency: {
              name: 'ETH',
              symbol: 'ETH',
              decimals: 18,
            },
          }],
        });
      } else {
        throw switchError;
      }
    }
  };

  const handleConnect = async () => {
    if (!window.ethereum) {
      alert('Please install a Web3 wallet');
      return;
    }

    setIsConnecting(true);
    
    try {
      // First switch to correct network
      await switchNetwork();
      
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      }) as string[];
      
      if (accounts.length > 0) {
        onConnect(accounts[0]);
      }
    } catch (error: unknown) {
      const err = error as { code?: number; message?: string };
      if (err.code === 4001) {
        alert('Connection rejected by user');
      } else {
        alert('Failed to connect wallet: ' + (err.message || 'Unknown error'));
      }
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <button
      onClick={handleConnect}
      disabled={isConnecting}
      className="btn-primary flex items-center gap-2"
    >
      <Wallet className="w-5 h-5" />
      {isConnecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
};

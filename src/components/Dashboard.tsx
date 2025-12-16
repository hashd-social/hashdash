import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useToast } from './Toast';
import { WelcomeScreen } from './dashboard/WelcomeScreen';
import { AuthScreen } from './dashboard/AuthScreen';
import { TabNavigation, TabId } from './dashboard/TabNavigation';
import { WaitlistTab } from './dashboard/WaitlistTab';
import { DomainsTab } from './dashboard/DomainsTab';
import { MintTab } from './dashboard/MintTab';
import { RoyaltiesTab } from './dashboard/RoyaltiesTab';
import { TreasuryTab } from './dashboard/TreasuryTab';
import { ContractsTab } from './dashboard/ContractsTab';
import { VaultTab } from './dashboard/VaultTab';

declare global {
  interface Window {
    ethereum?: any;
  }
}

export const Dashboard: React.FC = () => {
  const toast = useToast();
  const [userAddress, setUserAddress] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [signature, setSignature] = useState('');
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('waitlist');

  // Auto-reconnect on page load
  useEffect(() => {
    const reconnect = async () => {
      if (!window.ethereum) return;
      
      try {
        const accounts = await window.ethereum.request({ 
          method: 'eth_accounts' 
        }) as string[];
        
        if (accounts.length > 0) {
          setUserAddress(accounts[0]);
        }
      } catch (error) {
        console.error('Auto-reconnect failed:', error);
      }
    };
    
    reconnect();
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setUserAddress('');
        setIsAuthenticated(false);
        setSignature('');
        setMessage('');
      } else if (accounts[0] !== userAddress) {
        setUserAddress(accounts[0]);
        setIsAuthenticated(false);
        setSignature('');
        setMessage('');
      }
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
    };
  }, [userAddress]);

  const authenticate = async () => {
    setIsAuthenticating(true);
    try {
      const authMessage = `Hashd Admin Authentication\nWallet: ${userAddress}\nTimestamp: ${Date.now()}`;
      setMessage(authMessage);

      if (!window.ethereum) {
        throw new Error('MetaMask not found');
      }
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const sig = await signer.signMessage(authMessage);
      
      setSignature(sig);
      setIsAuthenticated(true);
      toast.success('Admin authenticated');
    } catch (error) {
      console.error('Authentication error:', error);
      toast.error('Failed to authenticate');
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Welcome screen - not connected
  if (!userAddress) {
    return <WelcomeScreen onConnect={setUserAddress} />;
  }

  // Auth screen
  if (!isAuthenticated) {
    return <AuthScreen isAuthenticating={isAuthenticating} onAuthenticate={authenticate} />;
  }

  // Render active tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'waitlist':
        return (
          <WaitlistTab
            userAddress={userAddress}
            signature={signature}
            message={message}
          />
        );
      case 'domains':
        return <DomainsTab userAddress={userAddress} />;
      case 'mint':
        return <MintTab userAddress={userAddress} />;
      case 'royalties':
        return <RoyaltiesTab userAddress={userAddress} />;
      case 'treasury':
        return <TreasuryTab userAddress={userAddress} />;
      case 'contracts':
        return <ContractsTab />;
      case 'vault':
        return <VaultTab />;
      default:
        return null;
    }
  };

  // Main dashboard
  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Hashd Logo" className="w-10 h-10" />
              <div>
                <h1 className="text-3xl font-bold text-white">HASHdash</h1>
                <p className="text-gray-400 text-sm">Admin Dashboard</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-gray-500 text-sm">Connected as</span>
              <p className="text-cyan-400 font-mono text-sm">
                {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab Content */}
        {renderTabContent()}
      </div>
    </div>
  );
};

import React from 'react';
import { Users, Globe, Percent, Wallet, FileCode, Sparkles } from 'lucide-react';

export type TabId = 'waitlist' | 'domains' | 'mint' | 'royalties' | 'treasury' | 'contracts';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const tabs: Tab[] = [
  { id: 'waitlist', label: 'Waitlist', icon: <Users size={18} /> },
  { id: 'domains', label: 'Domains', icon: <Globe size={18} /> },
  { id: 'mint', label: 'Mint', icon: <Sparkles size={18} /> },
  { id: 'royalties', label: 'Royalties', icon: <Percent size={18} /> },
  { id: 'treasury', label: 'Treasury', icon: <Wallet size={18} /> },
  { id: 'contracts', label: 'Contracts', icon: <FileCode size={18} /> },
];

interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="border-b border-gray-700 mb-6">
      <nav className="flex space-x-1" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-lg transition-colors
              ${activeTab === tab.id
                ? 'bg-gray-800 text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
              }
            `}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useToast } from './Toast';
import { WelcomeScreen } from './dashboard/WelcomeScreen';
import { AuthScreen } from './dashboard/AuthScreen';
import { StatsCards } from './dashboard/StatsCards';
import { SearchControls } from './dashboard/SearchControls';
import { WaitlistTable } from './dashboard/WaitlistTable';
import { NoteModal } from './dashboard/NoteModal';
import { WaitlistEntry, WaitlistStats } from '../types/waitlist';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

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
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [stats, setStats] = useState<WaitlistStats | null>(null);
  const [signature, setSignature] = useState('');
  const [message, setMessage] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [selectedNote, setSelectedNote] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      fetchWaitlist();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, page, statusFilter]);

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

  const fetchWaitlist = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: userAddress,
          signature,
          message,
          page,
          limit: 50,
          status: statusFilter || undefined,
          search: search || undefined
        }),
      });

      if (!response.ok) throw new Error('Failed to fetch waitlist');

      const data = await response.json();
      
      if (data.success && data.data) {
        setEntries(data.data.entries || []);
        setTotal(data.data.pagination?.total || 0);
        setStats(data.data.stats || null);
      } else if (data.entries) {
        setEntries(data.entries || []);
        setTotal(data.total || 0);
        setStats(data.stats || null);
      }
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Failed to fetch waitlist');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/waitlist/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: userAddress, signature, message, status: newStatus }),
      });

      const data = await response.json();
      if (!data.success) {
        toast.error(data.message || 'Failed to update status');
        return;
      }

      toast.success('Status updated');
      fetchWaitlist();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const resendVerification = async (id: string) => {
    if (!window.confirm('Resend verification email?')) return;

    try {
      const response = await fetch(`${API_URL}/api/admin/waitlist/${id}/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: userAddress, signature, message }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Verification email sent');
      } else {
        toast.error(data.message || 'Failed to send email');
      }
    } catch (error) {
      toast.error('Failed to send email');
    }
  };

  const deleteEntry = async (id: string) => {
    if (!window.confirm('Delete this entry?')) return;

    try {
      const response = await fetch(`${API_URL}/api/admin/waitlist/${id}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: userAddress, signature, message }),
      });

      const data = await response.json();
      if (!data.success) {
        toast.error(data.message || 'Failed to delete');
        return;
      }

      toast.success('Entry deleted');
      fetchWaitlist();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const exportCSV = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/waitlist/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: userAddress, signature, message }),
      });

      if (!response.ok) throw new Error('Failed to export');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hashd-waitlist-${Date.now()}.csv`;
      a.click();
    } catch (error) {
      toast.error('Failed to export');
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

  // Main dashboard
  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <img src="/logo.png" alt="Hashd Logo" className="w-10 h-10" />
            <h1 className="text-3xl font-bold text-white">HASHdash</h1>
          </div>
          <p className="text-gray-400">Manage Hashd waitlist entries</p>
        </div>

        <StatsCards stats={stats} />
        
        <SearchControls
          search={search}
          statusFilter={statusFilter}
          loading={loading}
          onSearchChange={setSearch}
          onStatusFilterChange={setStatusFilter}
          onSearch={fetchWaitlist}
          onExport={exportCSV}
        />

        <WaitlistTable
          entries={entries}
          page={page}
          total={total}
          onUpdateStatus={updateStatus}
          onResendVerification={resendVerification}
          onDelete={deleteEntry}
          onViewNote={(note) => {
            setSelectedNote(note);
            setShowNoteModal(true);
          }}
          onPageChange={setPage}
        />

        {showNoteModal && (
          <NoteModal
            note={selectedNote}
            onClose={() => setShowNoteModal(false)}
          />
        )}
      </div>
    </div>
  );
};

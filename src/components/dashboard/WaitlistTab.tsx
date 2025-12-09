import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../Toast';
import { StatsCards } from './StatsCards';
import { SearchControls } from './SearchControls';
import { WaitlistTable } from './WaitlistTable';
import { NoteModal } from './NoteModal';
import { WaitlistEntry, WaitlistStats } from '../../types/waitlist';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

interface WaitlistTabProps {
  userAddress: string;
  signature: string;
  message: string;
}

export const WaitlistTab: React.FC<WaitlistTabProps> = ({ userAddress, signature, message }) => {
  const toast = useToast();
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [stats, setStats] = useState<WaitlistStats | null>(null);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [selectedNote, setSelectedNote] = useState('');

  const fetchWaitlist = useCallback(async () => {
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
  }, [userAddress, signature, message, page, statusFilter, search, toast]);

  useEffect(() => {
    fetchWaitlist();
  }, [fetchWaitlist]);

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

  return (
    <div className="space-y-6">
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
  );
};

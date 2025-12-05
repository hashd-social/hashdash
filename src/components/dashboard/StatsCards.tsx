import React from 'react';
import { Users, Clock, CheckCircle, XCircle } from 'lucide-react';

interface Stats {
  total: number;
  byStatus: {
    pending?: number;
    approved?: number;
    rejected?: number;
  };
}

interface StatsCardsProps {
  stats: Stats | null;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => {
  if (!stats) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-2">
          <Users className="w-5 h-5 text-cyan-400" />
          <span className="text-sm text-gray-400 uppercase font-mono">Total</span>
        </div>
        <p className="text-3xl font-bold text-white">{stats.total}</p>
      </div>
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-2">
          <Clock className="w-5 h-5 text-yellow-400" />
          <span className="text-sm text-gray-400 uppercase font-mono">Pending</span>
        </div>
        <p className="text-3xl font-bold text-white">{stats.byStatus.pending || 0}</p>
      </div>
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-2">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <span className="text-sm text-gray-400 uppercase font-mono">Approved</span>
        </div>
        <p className="text-3xl font-bold text-white">{stats.byStatus.approved || 0}</p>
      </div>
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-2">
          <XCircle className="w-5 h-5 text-red-400" />
          <span className="text-sm text-gray-400 uppercase font-mono">Rejected</span>
        </div>
        <p className="text-3xl font-bold text-white">{stats.byStatus.rejected || 0}</p>
      </div>
    </div>
  );
};

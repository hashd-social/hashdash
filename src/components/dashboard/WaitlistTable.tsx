import React from 'react';
import { CheckCircle, XCircle, Mail, Trash2 } from 'lucide-react';

interface WaitlistEntry {
  _id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  walletAddress?: string;
  roles: string[];
  note?: string;
  xHandle?: string;
  posted?: boolean;
  postUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

interface WaitlistTableProps {
  entries: WaitlistEntry[];
  page: number;
  total: number;
  onUpdateStatus: (id: string, status: string) => void;
  onResendVerification: (id: string) => void;
  onDelete: (id: string) => void;
  onViewNote: (note: string) => void;
  onPageChange: (page: number) => void;
}

export const WaitlistTable: React.FC<WaitlistTableProps> = ({
  entries,
  page,
  total,
  onUpdateStatus,
  onResendVerification,
  onDelete,
  onViewNote,
  onPageChange,
}) => {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-900/50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-cyan-400 uppercase">Name</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-cyan-400 uppercase">Email</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-cyan-400 uppercase">X Handle</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-cyan-400 uppercase">Wallet</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-cyan-400 uppercase">Roles</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-cyan-400 uppercase">Note</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-cyan-400 uppercase">Posted</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-cyan-400 uppercase">Status</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-cyan-400 uppercase">Date</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-cyan-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {entries.map((entry) => (
              <tr key={entry._id} className="hover:bg-gray-900/30 transition-colors">
                <td className="px-6 py-4 text-sm text-white">{entry.name}</td>
                <td className="px-6 py-4 text-sm text-gray-400 font-mono">{entry.email}</td>
                <td className="px-6 py-4 text-sm font-mono">
                  {entry.xHandle ? (
                    <span className="text-purple-400">@{entry.xHandle}</span>
                  ) : (
                    <span className="text-gray-600">N/A</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm font-mono">
                  {entry.walletAddress ? (
                    <span className="text-cyan-400">{entry.walletAddress.slice(0, 6)}...{entry.walletAddress.slice(-4)}</span>
                  ) : (
                    <span className="text-gray-600">N/A</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm">
                  <div className="flex flex-wrap gap-1">
                    {entry.roles.map((role) => (
                      <span key={role} className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">{role}</span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm">
                  {entry.note ? (
                    <button
                      onClick={() => onViewNote(entry.note!)}
                      className="text-cyan-400 hover:text-cyan-300 font-bold"
                    >
                      View
                    </button>
                  ) : (
                    <span className="text-gray-600">-</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm">
                  {entry.posted ? (
                    <div className="flex items-center gap-2">
                      <span className="text-green-400">✓</span>
                      {entry.postUrl && (
                        <a href={entry.postUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 text-xs">View</a>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-600">-</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    entry.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                    entry.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {entry.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-400">
                  {new Date(entry.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-sm">
                  <div className="flex gap-2">
                    {!entry.emailVerified && (
                      <button onClick={() => onResendVerification(entry._id)} className="p-2 bg-cyan-500/20 text-cyan-400 rounded hover:bg-cyan-500/30" title="Resend Email">
                        <Mail className="w-4 h-4" />
                      </button>
                    )}
                    {entry.emailVerified && (
                      <div className="p-2 bg-green-500/20 text-green-400 rounded" title="Verified">
                        <CheckCircle className="w-4 h-4" />
                      </div>
                    )}
                    {entry.status !== 'approved' && (
                      <button onClick={() => onUpdateStatus(entry._id, 'approved')} className="p-2 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30" title="Approve">
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                    {entry.status !== 'rejected' && (
                      <button onClick={() => onUpdateStatus(entry._id, 'rejected')} className="p-2 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30" title="Reject">
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => onDelete(entry._id)} className="p-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 50 && (
        <div className="px-6 py-4 bg-gray-900/50 border-t border-gray-700 flex items-center justify-between">
          <p className="text-sm text-gray-400">
            Showing {(page - 1) * 50 + 1} to {Math.min(page * 50, total)} of {total}
          </p>
          <div className="flex gap-2">
            <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1} className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50">
              Previous
            </button>
            <button onClick={() => onPageChange(page + 1)} disabled={page * 50 >= total} className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

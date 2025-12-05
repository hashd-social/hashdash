import React from 'react';
import { Search, Filter, Download } from 'lucide-react';

interface SearchControlsProps {
  search: string;
  statusFilter: string;
  loading: boolean;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onSearch: () => void;
  onExport: () => void;
}

export const SearchControls: React.FC<SearchControlsProps> = ({
  search,
  statusFilter,
  loading,
  onSearchChange,
  onStatusFilterChange,
  onSearch,
  onExport,
}) => {
  return (
    <div className="card p-6 mb-6">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name, email, or wallet..."
            className="input-primary pl-12"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="input-primary pl-12 pr-8 appearance-none cursor-pointer"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <button onClick={onExport} className="btn-secondary flex items-center gap-2">
          <Download className="w-5 h-5" />
          Export CSV
        </button>
        <button onClick={onSearch} disabled={loading} className="btn-primary">
          {loading ? 'Loading...' : 'Search'}
        </button>
      </div>
    </div>
  );
};

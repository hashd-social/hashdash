export interface WaitlistEntry {
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

export interface WaitlistStats {
  total: number;
  byStatus: {
    pending?: number;
    approved?: number;
    rejected?: number;
  };
}

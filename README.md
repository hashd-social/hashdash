# HASHDash

HASHDash is the operational dashboard for the HASHD network.
It’s used to manage onboarding, approvals, and visibility around the HASHD protocol without being part of the protocol itself.

In practice, HASHDash is where admins and operators handle things like application review, waitlists, basic analytics, and network oversight. It authenticates via wallets, reflects on-chain state where relevant, and interacts with HASHD services, but it does not hold encryption keys, control access to content, or participate in message privacy.

The dashboard exists to support early-stage operations and coordination while the protocol is still evolving. As HASHD becomes more permissionless, the role of HASHDash is expected to shrink or shift, but today it provides a pragmatic interface for managing the human and operational layer around a decentralized communications network.

## Setup

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Update the `.env` to point to the API:
```
REACT_APP_API_URL=http://localhost:3002
```

3. Install dependencies:
```bash
yarn install
```

4. Start the dashboard:
```bash
yarn start
```

The dashboard will run on http://localhost:3000

## Features

- Wallet-based admin authentication
- View and manage waitlist entries
- Approve/reject applications
- Export data to CSV
- Resend verification emails
- Search and filter functionality

## Authentication

1. Connect your wallet
2. Sign authentication message
3. Access dashboard features

## Tech Stack

- React + TypeScript
- Tailwind CSS
- ethers.js
- Lucide React icons

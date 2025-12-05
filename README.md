# HASHDash

Official Management Portal for HASHD waitlist onboarding, analytics, and operational controls. This system is separate from the HASHD protocol and does not affect the main client.

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

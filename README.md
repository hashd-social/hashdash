# HASHDash

HASHDash is the operational dashboard for the HASHD network. It’s used to manage onboarding, approvals, and visibility around the HASHD protocol without being part of the protocol itself.

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

3. **Configure ByteCave P2P Peers** (see [P2P Configuration](#p2p-configuration) below)

4. Install dependencies:
```bash
yarn install
```

5. Start the dashboard:
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

## P2P Configuration

The dashboard uses a **persistent peer configuration** system that automatically maintains and updates connected peers.

### How It Works

1. **Initial Setup**: On first launch, peers are loaded from `.env` variables
2. **Automatic Persistence**: Connected peers are saved to browser localStorage
3. **Auto-Discovery**: Newly discovered peers are automatically added to the config
4. **Persistent Across Sessions**: Peers persist between dashboard restarts

### Environment Variables

Configure initial peers in `.env`:

```bash
# Direct node addresses for WebSocket connections (no circuit relay needed)
# Example: bat-alpha (P2P WS port 5012), bat-beta (5022), bat-gamma (5032)
REACT_APP_DIRECT_NODE_ADDRS=/ip4/127.0.0.1/tcp/5012/ws/p2p/12D3KooW...,/ip4/127.0.0.1/tcp/5022/ws/p2p/12D3KooW...

# Relay peers for circuit relay fallback (NAT traversal)
REACT_APP_RELAY_PEERS=/ip4/127.0.0.1/tcp/4002/ws/p2p/12D3KooW...
```

### Peer Configuration Storage

**Why localStorage?** Discovered peers are saved to browser localStorage for faster reconnection on subsequent visits. This means:
- **Faster startup**: No need to rediscover peers every time
- **Better UX**: Connects to known-good peers immediately
- **Persistent sessions**: Peer list survives page refreshes

Peers are stored in browser localStorage as `bytecave_peers`:

```json
{
  "directNodeAddrs": [
    "/ip4/127.0.0.1/tcp/5012/ws/p2p/12D3KooW...",
    "/ip4/127.0.0.1/tcp/5022/ws/p2p/12D3KooW..."
  ],
  "relayPeers": [
    "/ip4/127.0.0.1/tcp/4002/ws/p2p/12D3KooW..."
  ],
  "lastUpdated": "2026-01-13T11:42:00.000Z"
}
```

### Resetting Peer Configuration

To reset peers and reload from `.env`:

1. Open browser DevTools (F12)
2. Go to Application → Local Storage
3. Delete the `bytecave_peers` key
4. Refresh the dashboard

The dashboard will recreate the config from `.env` variables.

### Connection Priority

The dashboard tries connections in this order:

1. **Direct WebSocket** - Tries `REACT_APP_DIRECT_NODE_ADDRS` first (no circuit relay)
2. **Circuit Relay** - Falls back to `REACT_APP_RELAY_PEERS` if direct fails
3. **On-chain Discovery** - Discovers additional nodes from VaultRegistry contract

### Decentralized Operation

With direct node addresses configured, the dashboard can operate **without a circuit relay**:

- ✅ Direct WebSocket connections to storage nodes (P2P via libp2p)
- ✅ Automatic peer discovery via gossip
- ✅ No single point of failure
- ✅ Censorship resistant

**Note:** Connections use WebSocket transport (`/ws/` in multiaddrs), not WebRTC. WebRTC support exists in bytecave-core but requires relay-assisted signaling.

## Tech Stack

- React + TypeScript
- Tailwind CSS
- ethers.js
- Lucide React icons
- libp2p (WebSockets, Circuit Relay)
- @gethashd/bytecave-browser (P2P storage client)

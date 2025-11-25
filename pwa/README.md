# Zault PWA

Post-quantum encrypted P2P chat application.

**Live at [zault.chat](https://zault.chat)**

## Features

- **No accounts** - Identity is a cryptographic keypair
- **End-to-end encrypted** - Messages decrypted only in your browser
- **Post-quantum secure** - ML-KEM-768 for key exchange
- **1:1 and group chat** - With key rotation on member removal
- **Offline-first** - Works without network, syncs when connected
- **30+ themes** - DaisyUI theme support
- **PWA** - Install on any device

## Tech Stack

- **Frontend:** SolidJS + SolidStart
- **Styling:** Tailwind CSS + DaisyUI
- **Crypto:** zault.wasm (Zig compiled to WebAssembly)
- **Storage:** IndexedDB (via localforage)
- **Realtime:** WebSocket signaling server
- **Testing:** Playwright

## Development

### Prerequisites

- Bun 1.0+
- Node.js 18+ (for Playwright)

### Setup

```bash
# Install dependencies
bun install

# Build WASM module (from project root)
cd ..
zig build
cp zig-out/bin/zault.wasm pwa/public/
cd pwa
```

### Development Server

```bash
bun run dev
# Opens http://localhost:3000
```

### Production Build

```bash
bun run build
# Output in .output/
```

### Preview Production Build

```bash
bun run preview
```

## Testing

```bash
# Install Playwright browsers
bunx playwright install

# Run all tests
bunx playwright test

# Run specific test file
bunx playwright test tests/chat.spec.ts

# Run with UI
bunx playwright test --ui

# Debug mode
bunx playwright test --debug

# Generate report
bunx playwright test --reporter=html
```

### Test Coverage

| Suite | Tests | Description |
|-------|-------|-------------|
| identity.spec.ts | 5 | Identity generation, persistence, sharing |
| contacts.spec.ts | 3 | Add contacts via link/JSON |
| chat.spec.ts | 5 | Send/receive, persistence, offline sync |
| groups.spec.ts | 5 | Group creation, messaging, settings |
| connection.spec.ts | 4 | WebSocket status, reconnection |

## Project Structure

```
pwa/
├── src/
│   ├── app.tsx              # Main app component
│   ├── app.css              # Global styles
│   ├── entry-client.tsx     # Client entry
│   ├── entry-server.tsx     # Server entry (SSR)
│   ├── ws.ts                # WebSocket signaling server
│   ├── lib/
│   │   ├── crypto.ts        # WASM wrapper
│   │   ├── storage.ts       # IndexedDB persistence
│   │   ├── p2p.ts           # WebSocket client
│   │   ├── sync.ts          # CRDT sync logic
│   │   ├── group-crypto.ts  # Group key management
│   │   └── settings.ts      # User preferences
│   ├── routes/
│   │   ├── index.tsx        # Home (contacts/groups)
│   │   ├── add.tsx          # Add contact
│   │   ├── settings.tsx     # Settings page
│   │   ├── chat/[id].tsx    # 1:1 chat
│   │   ├── group/new.tsx    # Create group
│   │   ├── group/[id].tsx   # Group chat
│   │   └── group-settings/[id].tsx
│   └── components/
│       └── OfflineIndicator.tsx
├── tests/
│   ├── helpers.ts           # Test utilities
│   └── *.spec.ts            # Test files
├── public/
│   ├── zault.wasm           # Crypto module
│   └── icons/               # PWA icons
├── app.config.ts            # SolidStart + PWA config
├── playwright.config.ts     # Test config
├── fly.toml                 # Fly.io deployment
└── Dockerfile               # Container build
```

## Configuration

### `app.config.ts`

Key configurations:

- WebSocket endpoint at `/ws`
- VitePWA for service worker and manifest
- Workbox for offline caching

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `development` |
| `PORT` | Server port | `3000` |

## Deployment

### Fly.io (Recommended)

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Deploy
fly deploy
```

### Docker

```bash
# Build
docker build -t zault-pwa .

# Run
docker run -p 3000:3000 zault-pwa
```

### Manual

```bash
bun run build
bun run start
```

## Architecture

### Crypto Layer

All cryptography happens in `zault.wasm`:

- **ML-DSA-65** - Digital signatures
- **ML-KEM-768** - Key encapsulation (1:1 chat)
- **ChaCha20-Poly1305** - Symmetric encryption (groups)
- **SHA3-256** - Hashing

### Message Flow

```
Alice                    Server                    Bob
  │                        │                        │
  │ ── encrypted msg ────▶ │ ── encrypted msg ────▶ │
  │                        │                        │
  │ (Server routes only)   │                        │
  │ (Cannot decrypt)       │                        │
```

### Offline Sync

Uses CRDT-style vector clocks:

1. Messages stored encrypted in IndexedDB
2. On reconnect, exchange vector clocks
3. Request missing messages by ID
4. Merge without conflicts

## Theming

30+ DaisyUI themes available in Settings:

**Light:** light, cupcake, bumblebee, emerald, corporate, retro, cyberpunk, valentine, garden, lofi, pastel, fantasy, wireframe, cmyk, autumn, acid, lemonade, winter, nord

**Dark:** dark, synthwave, halloween, forest, aqua, black, luxury, dracula, night, coffee, dim, sunset, zault (custom)

## Security

See [Security Model](../book/src/security-model.md) for details.

**Key points:**
- Server cannot read messages
- Keys never leave your device
- Post-quantum resistant algorithms
- Messages stored encrypted locally

## Contributing

1. Fork the repository
2. Create feature branch
3. Write tests for new features
4. Ensure all tests pass
5. Submit pull request

## License

MIT

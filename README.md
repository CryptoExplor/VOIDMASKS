# VOIDMASKS

SIP-009 NFT collection with on-chain SVG generation. Each token ID generates a unique deterministic mask using pure mathematics and blockchain data.

## Features

- ✅ **SIP-009 Compliant** - Standard NFT contract
- ✅ **On-Chain SVG** - Art generated deterministically from token ID
- ✅ **No IPFS** - 100% on-chain storage
- ✅ **Gas Optimized** - Minimal on-chain footprint
- ✅ **Wallet Integration** - Leather & Xverse support
- ✅ **Brutalist Design** - Schizocore aesthetic

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

## Architecture

```
voidmasks/
├── package.json
├── vite.config.js
├── vercel.json
├── .gitignore
├── README.md
├── contracts/
│   └── voidmasks.clar          ← SIP-009 NFT contract
└── src/
    ├── index.html               ← HTML structure
    ├── main.js                  ← Entry point
    ├── config.js                ← All settings
    ├── wallet.js                ← Leather/Xverse
    ├── contract.js              ← Contract reads
    ├── svg.js                   ← SVG engine
    ├── ui.js                    ← UI controller
    └── styles.css               ← Brutalist styles
```

## Contract Details

The SIP-009 compliant contract stores only the token ID and owner. All metadata and artwork are generated deterministically from the token ID using mathematical algorithms.
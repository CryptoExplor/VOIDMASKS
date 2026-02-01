# VOIDMASKS

> 100% On-Chain Schizocore PFP Collection on Stacks

![VOIDMASKS](https://img.shields.io/badge/Network-Stacks-blueviolet) ![Clarity](https://img.shields.io/badge/Clarity-4-blue) ![SIP-009](https://img.shields.io/badge/SIP--009-Compliant-green) ![License](https://img.shields.io/badge/License-MIT-yellow)

VOIDMASKS is a **Phase-8 schizocore PFP collection** with fully deterministic on-chain SVG generation. Built with Clarity 4 on Stacks blockchain, secured by Bitcoin. Each mask is generated using pure mathematics—no IPFS, no external dependencies, just blockchain art.

## 🎭 Features

- ✅ **SIP-009 Compliant** - Standard NFT interface
- ✅ **100% On-Chain SVG** - Art generated deterministically from token ID
- ✅ **No IPFS** - Zero external dependencies
- ✅ **Clarity 4** - Latest Clarity version with advanced features
- ✅ **Free Mint** - One per address, 10,000 max supply
- ✅ **Wallet Integration** - Leather & Xverse support
- ✅ **Brutalist Design** - Schizocore cyberpunk aesthetic
- ✅ **Multi-Network** - Mainnet & Testnet support with one-click switching

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Leather or Xverse wallet (for minting)
- Clarinet (for local contract testing)

### Installation

```bash
# Clone the repository
git clone https://github.com/CryptoExplor/VOIDMASKS.git
cd VOIDMASKS

# Install dependencies
npm install

# Run development server
npm run dev
```

The app will open at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

## 🏗️ Architecture

```
voidmasks/
├── contracts/
│   └── voidmasks.clar          # SIP-009 NFT smart contract (Clarity 4)
├── src/
│   ├── index.html              # Main HTML structure
│   ├── main.js                 # Application entry point
│   ├── config.js               # Network & contract configuration
│   ├── wallet.js               # Wallet connection (Leather/Xverse)
│   ├── contract.js             # Contract interaction layer
│   ├── svg.js                  # Deterministic SVG generation engine
│   ├── ui.js                   # UI state management
│   └── styles.css              # Brutalist CSS styling
├── api/
│   ├── metadata/[id].js        # SIP-009 metadata endpoint
│   ├── svg/[id].js             # On-chain SVG retrieval
│   └── debug-svg/[id].js       # Debug endpoint for testing
├── deployments/
│   ├── default.mainnet-plan.yaml
│   └── default.testnet-plan.yaml
├── settings/
│   ├── Mainnet.toml            # Mainnet deployment config
│   └── Testnet.toml            # Testnet deployment config
├── package.json
├── vite.config.js
├── vercel.json
└── README.md
```

## 📜 Smart Contract

The VOIDMASKS contract is built with **Clarity 4** and implements the **SIP-009 NFT standard**.

### Key Functions

**Public Functions:**
- `mint()` - Mint a free NFT (one per address)
- `transfer()` - Transfer NFT to another address

**Read-Only Functions:**
- `get-last-token-id()` - Get the most recent token ID
- `get-token-uri()` - Get metadata URI for a token
- `get-owner()` - Get owner of a specific token
- `get-traits()` - Get all trait values for a token
- `get-svg()` - Generate complete SVG on-chain
- `has-minted()` - Check if address has already minted

### On-Chain SVG Generation

Each token ID generates 7 deterministic traits:
- **Expression** (10 variants) - Eye styles
- **Mouth** (9 variants) - Mouth shapes
- **Aura** (8 variants) - Surrounding effects
- **Corruption** (6 variants) - Glitch elements
- **Symbol** (6 variants) - Forehead marks
- **Palette** (8 variants) - Color schemes
- **Background** (8 variants) - Background colors

Total possible combinations: **10 × 9 × 8 × 6 × 6 × 8 × 8 = 1,658,880 unique masks**

## 🌐 Deployment

### Testnet Deployment

1. Configure testnet settings in `settings/Testnet.toml`
2. Deploy using Clarinet:

```bash
clarinet deploy --network=testnet
```

### Mainnet Deployment

1. Configure mainnet settings in `settings/Mainnet.toml`
2. Deploy using Clarinet:

```bash
clarinet deploy --network=mainnet
```

### Vercel Deployment

The frontend is configured for Vercel deployment:

```bash
# Deploy to Vercel
vercel --prod
```

Environment variables are set in `vercel.json`:
- `NETWORK` - "mainnet" or "testnet"
- `CONTRACT_ADDRESS` - Deployed contract address
- `CONTRACT_NAME` - Contract name

## 🎨 How It Works

### Deterministic Art Generation

1. **Token ID → Traits**: Each token ID is divided mathematically to generate trait indices
2. **Traits → SVG Layers**: Each trait maps to specific SVG elements
3. **Layer Concatenation**: All layers are concatenated on-chain to form complete SVG
4. **Pure Mathematics**: No randomness, no external calls—100% deterministic

### Example Trait Calculation

```clarity
;; For token #1234:
expression: 1234 % 10 = 4
mouth: (1234 / 10) % 9 = 3
aura: (1234 / 90) % 8 = 3
corruption: (1234 / 720) % 6 = 1
symbol: (1234 / 4320) % 6 = 0
palette: (1234 / 25920) % 8 = 0
background: (1234 / 207360) % 8 = 0
```

## 🔧 Configuration

Edit `src/config.js` to switch networks or update contract details:

```javascript
export const CONFIG = {
    NETWORK: 'mainnet', // or 'testnet'
    CONTRACT_ADDRESS: 'SP3ZQXJPR493FCYNAVFX1YSK7EMT6JF909EZHVE9A',
    CONTRACT_NAME: 'voidmasks',
    STACKS_API: 'https://api.hiro.so',
    MINT_FEE: 0, // Free mint
    // ... other settings
};
```

Or use the network toggle button in the UI to switch between mainnet and testnet.

## 🧪 Testing

### Local Testing with Clarinet

```bash
# Run tests
clarinet test

# Check contract
clarinet check

# Open console
clarinet console
```

### Contract Functions in Console

```clarity
;; Mint token
(contract-call? .voidmasks mint)

;; Get SVG for token #1
(contract-call? .voidmasks get-svg u1)

;; Get traits for token #1
(contract-call? .voidmasks get-traits u1)

;; Check if address minted
(contract-call? .voidmasks has-minted tx-sender)
```

## 📊 API Endpoints

### Metadata Endpoint
```
GET /api/metadata/[id]
```
Returns SIP-009 compliant JSON metadata.

### SVG Endpoint
```
GET /api/svg/[id]
```
Returns the on-chain generated SVG image.

### Debug Endpoint
```
GET /api/debug-svg/[id]
```
Returns detailed trait analysis and SVG validation data.

## 🔐 Security

- **One mint per address** enforced on-chain
- **No admin functions** - fully decentralized
- **Immutable artwork** - SVG generation logic is permanent
- **Transparent** - All code is open source and auditable

## 🎮 User Guide

### Connecting Your Wallet

1. Click "Connect Wallet" button
2. Select Leather or Xverse from your browser extensions
3. Approve the connection request
4. Your address will be displayed

### Minting an NFT

1. Connect your wallet
2. Click "Mint NFT" button
3. Approve the transaction in your wallet
4. Wait for confirmation (usually 10-20 minutes on mainnet)
5. Your VOIDMASK will appear in "Your Collection"

### Viewing Tokens

- **Your Collection**: See all NFTs you own
- **Token Explorer**: Enter any token ID to view its artwork
- **Network Switch**: Toggle between mainnet and testnet

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **Live App**: [voidmasks.vercel.app](https://voidmasks.vercel.app)
- **GitHub**: [github.com/CryptoExplor/VOIDMASKS](https://github.com/CryptoExplor/VOIDMASKS)
- **Stacks Docs**: [docs.stacks.co](https://docs.stacks.co)
- **Clarity Book**: [book.clarity-lang.org](https://book.clarity-lang.org)
- **Testnet Faucet**: [stacks-jar.vercel.app](https://stacks-jar.vercel.app)

## 🙏 Acknowledgments

- Built on [Stacks](https://www.stacks.co/) blockchain
- Secured by [Bitcoin](https://bitcoin.org/)
- Powered by [Clarity](https://clarity-lang.org/)
- Wallet support: [Leather](https://leather.io/) & [Xverse](https://www.xverse.app/)
- Deployed on [Vercel](https://vercel.com/)

## 📈 Roadmap

- [x] Core contract development
- [x] On-chain SVG generation
- [x] Wallet integration
- [x] Mainnet deployment
- [x] Multi-network support
- [ ] Secondary marketplace integration
- [ ] Trait rarity statistics
- [ ] Community voting features
- [ ] Additional trait variations

## ❓ FAQ

**Q: How much does it cost to mint?**  
A: Minting is completely free! You only pay the gas fee (transaction fee) to the Stacks network.

**Q: Can I mint more than one?**  
A: No, the contract enforces a limit of one mint per address.

**Q: How are the NFTs generated?**  
A: Each NFT is generated deterministically from its token ID using mathematical algorithms. The SVG is created entirely on-chain.

**Q: What happens if the website goes down?**  
A: Your NFT is stored on the blockchain, not on any server. The art generation logic is in the smart contract and will work forever.

**Q: Can I sell my VOIDMASK?**  
A: Yes! You can transfer it to any Stacks address using the `transfer` function or through compatible NFT marketplaces.

**Q: What networks are supported?**  
A: Both Stacks mainnet and testnet. Use the network toggle in the UI to switch between them.

---

**Made with 🖤 by CryptoExplor**

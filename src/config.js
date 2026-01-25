// Network presets
const NETWORKS = {
    testnet: {
        NETWORK: 'testnet',
        CONTRACT_ADDRESS: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
        STACKS_API: 'https://api.testnet.hiro.so',
        MINT_FEE: 0, // Free
        MIN_FEE_DISPLAY: 'Free'
    },
    mainnet: {
        NETWORK: 'mainnet',
        CONTRACT_ADDRESS: 'SP1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM', // Placeholder: Update with actual Mainnet address
        STACKS_API: 'https://api.mainnet.hiro.so',
        MINT_FEE: 0, // Free mint
        MIN_FEE_DISPLAY: 'Free'
    }
};

// Current active configuration (starts with testnet)
export const CONFIG = {
    ...NETWORKS.testnet,

    // Static settings
    CONTRACT_NAME: 'voidmasks',
    GAS_LIMIT: 10000000,
    REFRESH_INTERVAL: 30000,
    MAX_TOKENS_DISPLAY: 50,
    SUPPORTED_WALLETS: ['leather', 'xverse'],
    BRAND_COLORS: {
        primary: '#00ff00',
        secondary: '#ff00ff',
        background: '#000000',
        text: '#ffffff'
    }
};

// Toggle network function
export function toggleNetwork() {
    const newNetwork = CONFIG.NETWORK === 'testnet' ? 'mainnet' : 'testnet';
    const settings = NETWORKS[newNetwork];

    // Update mutable CONFIG object
    Object.assign(CONFIG, settings);

    return CONFIG.NETWORK;
}

// Utility functions
export const utils = {
    // Convert microSTX to STX
    microToStx(microStx) {
        return microStx / 1000000;
    },

    // Convert STX to microSTX
    stxToMicro(stx) {
        return stx * 1000000;
    },

    // Truncate address for display
    truncateAddress(address, startLength = 6, endLength = 4) {
        if (!address) return '';
        return `${address.substring(0, startLength)}...${address.substring(address.length - endLength)}`;
    },

    // Format token ID
    formatTokenId(tokenId) {
        return `#${tokenId.toString().padStart(4, '0')}`;
    }
};
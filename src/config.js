// VOIDMASKS Configuration
export const CONFIG = {
    // Network configuration
    NETWORK: 'mainnet', // or 'testnet'
    
    // Contract details
    CONTRACT_ADDRESS: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM', // Replace with actual contract address
    CONTRACT_NAME: 'voidmasks',
    
    // API endpoints
    STACKS_API: 'https://api.mainnet.hiro.so', // Mainnet API
    // STACKS_API: 'https://api.testnet.hiro.so', // Testnet API
    
    // Transaction fees
    MINT_FEE: 1000000, // 1 STX in microSTX
    GAS_LIMIT: 10000000,
    
    // UI settings
    REFRESH_INTERVAL: 30000, // 30 seconds
    MAX_TOKENS_DISPLAY: 50,
    
    // Wallet providers
    SUPPORTED_WALLETS: ['leather', 'xverse'],
    
    // Colors and themes
    BRAND_COLORS: {
        primary: '#00ff00',
        secondary: '#ff00ff',
        background: '#000000',
        text: '#ffffff'
    }
};

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
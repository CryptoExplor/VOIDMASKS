import { CONFIG, utils } from './config.js';
import { updateUIState } from './ui.js';
import { STACKS_MAINNET, STACKS_TESTNET } from '@stacks/network';
import {
  AnchorMode,
  PostConditionMode,
} from '@stacks/transactions';

// Global wallet state
let walletState = {
    isConnected: false,
    address: null,
    provider: null
};

// Storage keys
const STORAGE_KEYS = {
    WALLET_STATE: 'voidmasks_wallet_state',
    NETWORK: 'voidmasks_network'
};

// Load wallet state from localStorage
function loadWalletState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEYS.WALLET_STATE);
        if (saved) {
            const parsed = JSON.parse(saved);
            // Only restore if network matches
            if (parsed.network === CONFIG.NETWORK) {
                return parsed;
            }
        }
    } catch (error) {
        console.error('Failed to load wallet state:', error);
    }
    return null;
}

// Save wallet state to localStorage
function saveWalletState() {
    try {
        localStorage.setItem(STORAGE_KEYS.WALLET_STATE, JSON.stringify(walletState));
    } catch (error) {
        console.error('Failed to save wallet state:', error);
    }
}

// Clear wallet state from localStorage
function clearWalletState() {
    try {
        localStorage.removeItem(STORAGE_KEYS.WALLET_STATE);
    } catch (error) {
        console.error('Failed to clear wallet state:', error);
    }
}

// Initialize wallet on page load
export function initializeWallet() {
    const savedState = loadWalletState();
    if (savedState && savedState.isConnected) {
        walletState = savedState;
        updateUIState('connected', walletState);
        console.log('Restored wallet connection:', walletState.address);
    }
}

// Check if wallet is installed
export function isWalletInstalled(walletType) {
    switch (walletType) {
        case 'leather':
            return typeof window.LeatherProvider !== 'undefined';
        case 'xverse':
            return typeof window.XverseProviders !== 'undefined';
        default:
            return false;
    }
}

// Connect to wallet
export async function connectWallet() {
    try {
        // Try Leather first
        if (isWalletInstalled('leather')) {
            await connectLeather();
        } else if (isWalletInstalled('xverse')) {
            await connectXverse();
        } else {
            throw new Error('No supported wallet found. Please install Leather or Xverse wallet.');
        }
    } catch (error) {
        console.error('Wallet connection failed:', error);
        alert(`Connection failed: ${error.message}`);
    }
}

// Connect to Leather wallet
async function connectLeather() {
    const provider = window.LeatherProvider;

    if (!provider) {
        throw new Error('Leather wallet not found');
    }

    try {
        // Request Stacks addresses with network specification
        const response = await provider.request('getAddresses', {
            network: CONFIG.NETWORK === 'mainnet' ? 'mainnet' : 'testnet'
        });

        if (response.result) {
            const addresses = response.result.addresses;
            // Get the Stacks address (not Bitcoin)
            const stacksAddress = addresses.find(addr => addr.type === 'stacks' || addr.symbol === 'STX');

            if (!stacksAddress) {
                throw new Error('No Stacks address found. Please ensure you are connected to the Stacks network.');
            }

            const address = stacksAddress.address;

            walletState = {
                isConnected: true,
                address: address,
                provider: 'leather',
                network: CONFIG.NETWORK
            };

            saveWalletState();
            updateUIState('connected', walletState);
            console.log(`Connected to Leather wallet (${CONFIG.NETWORK}):`, address);
        }
    } catch (error) {
        throw new Error(`Leather connection failed: ${error.message}`);
    }
}

// Connect to Xverse wallet
async function connectXverse() {
    const provider = window.XverseProviders?.StacksProvider;

    if (!provider) {
        throw new Error('Xverse wallet not found');
    }

    try {
        // Request addresses with proper network configuration
        const response = await provider.request('getAddresses', {
            purposes: ['stacks'],
            message: 'Connect to VOIDMASKS',
            network: {
                type: CONFIG.NETWORK === 'mainnet' ? 'Mainnet' : 'Testnet'
            }
        });

        if (response && response.addresses) {
            // Get the Stacks address
            const stacksAddr = response.addresses.find(addr => addr.purpose === 'stacks');

            if (!stacksAddr) {
                throw new Error('No Stacks address found in Xverse response.');
            }

            const address = stacksAddr.address;

            walletState = {
                isConnected: true,
                address: address,
                provider: 'xverse',
                network: CONFIG.NETWORK
            };

            saveWalletState();
            updateUIState('connected', walletState);
            console.log(`Connected to Xverse wallet (${CONFIG.NETWORK}):`, address);
        }
    } catch (error) {
        throw new Error(`Xverse connection failed: ${error.message}`);
    }
}

// Disconnect wallet
export function disconnectWallet() {
    walletState = {
        isConnected: false,
        address: null,
        provider: null
    };

    clearWalletState();
    updateUIState('disconnected');
    console.log('Wallet disconnected');
}

// Get current wallet state
export function getWalletState() {
    return { ...walletState };
}

// Execute mint transaction - USES WALLET NATIVE APIs
export async function executeMint() {
    if (!walletState.isConnected) {
        throw new Error('Wallet not connected');
    }

    try {
        console.log('=== EXECUTING MINT ===');
        console.log('Wallet:', walletState.provider);
        console.log('Address:', walletState.address);
        console.log('Network:', CONFIG.NETWORK);

        // Parse contract address
        const contractParts = CONFIG.CONTRACT_ADDRESS.includes('.') 
            ? CONFIG.CONTRACT_ADDRESS.split('.')
            : [CONFIG.CONTRACT_ADDRESS, CONFIG.CONTRACT_NAME];

        const contractAddress = contractParts[0];
        const contractName = contractParts[1];

        console.log('Contract:', `${contractAddress}.${contractName}`);

        // Sign with appropriate wallet
        let txId;
        if (walletState.provider === 'leather') {
            txId = await signWithLeather(contractAddress, contractName);
        } else if (walletState.provider === 'xverse') {
            txId = await signWithXverse(contractAddress, contractName);
        } else {
            throw new Error('Unknown wallet provider');
        }

        return { success: true, txId };
    } catch (error) {
        console.error('Mint execution failed:', error);
        throw error;
    }
}

// Sign with Leather - USES LEATHER'S NATIVE API
async function signWithLeather(contractAddress, contractName) {
    try {
        console.log('Requesting Leather to sign transaction...');

        // Leather's stx_callContract method
        const result = await window.LeatherProvider.request('stx_callContract', {
            contractAddress: contractAddress,
            contractName: contractName,
            functionName: 'mint',
            functionArgs: [],
            network: CONFIG.NETWORK,
            postConditions: [],
        });

        console.log('Leather response:', result);

        if (!result || !result.result) {
            throw new Error('No response from Leather wallet');
        }

        // Extract transaction ID
        const txId = result.result.txId || result.result.txid || result.result;
        console.log('Transaction ID:', txId);

        return txId;
    } catch (error) {
        console.error('Leather signing error:', error);
        // Provide more helpful error message
        if (error.message.includes('User rejected')) {
            throw new Error('Transaction cancelled by user');
        }
        throw new Error(`Leather signing failed: ${error.message}`);
    }
}

// Sign with Xverse - USES XVERSE'S NATIVE API
async function signWithXverse(contractAddress, contractName) {
    try {
        console.log('Requesting Xverse to sign transaction...');

        // Xverse's stx_callContract method
        const result = await window.XverseProviders.StacksProvider.request('stx_callContract', {
            contractAddress: contractAddress,
            contractName: contractName,
            functionName: 'mint',
            functionArgs: [],
            network: CONFIG.NETWORK === 'mainnet' ? 'mainnet' : 'testnet',
        });

        console.log('Xverse response:', result);

        if (!result || !result.result) {
            throw new Error('No response from Xverse wallet');
        }

        // Extract transaction ID
        const txId = result.result.txid || result.result.txId || result.result;
        console.log('Transaction ID:', txId);

        return txId;
    } catch (error) {
        console.error('Xverse signing error:', error);
        // Provide more helpful error message
        if (error.message.includes('User rejected')) {
            throw new Error('Transaction cancelled by user');
        }
        throw new Error(`Xverse signing failed: ${error.message}`);
    }
}

// Legacy function for compatibility with contract.js
// This is kept for backwards compatibility but not used in the new flow
export async function signTransaction(txOptions, senderAddress, provider) {
    console.log('=== LEGACY SIGN TRANSACTION (NOT USED) ===');
    console.log('Use executeMint() instead');
    throw new Error('This function is deprecated. Use executeMint() instead.');
}

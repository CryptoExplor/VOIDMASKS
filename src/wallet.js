import { CONFIG, utils } from './config.js';
import { updateUIState } from './ui.js';
import { mintNFT } from './contract.js';
import { bytesToHex } from '@stacks/common';

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

            saveWalletState(); // Save to localStorage
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

            saveWalletState(); // Save to localStorage
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

    clearWalletState(); // Clear from localStorage
    updateUIState('disconnected');
    console.log('Wallet disconnected');
}

// Get current wallet state
export function getWalletState() {
    return { ...walletState };
}

// Execute mint transaction
export async function executeMint() {
    if (!walletState.isConnected) {
        throw new Error('Wallet not connected');
    }

    try {
        const result = await mintNFT(walletState.address, walletState.provider);
        return result;
    } catch (error) {
        console.error('Mint transaction failed:', error);
        throw error;
    }
}

// Sign and broadcast transaction - COMPLETELY REWRITTEN
export async function signTransaction(transaction, provider) {
    try {
        console.log('=== SIGNING TRANSACTION ===');
        console.log('Provider:', provider);
        console.log('Transaction:', transaction);

        if (provider === 'leather') {
            return await signWithLeather(transaction);
        } else if (provider === 'xverse') {
            return await signWithXverse(transaction);
        } else {
            throw new Error(`Unsupported provider: ${provider}`);
        }

    } catch (error) {
        console.error('=== SIGNING ERROR ===');
        console.error('Error:', error);
        console.error('Stack:', error.stack);
        throw new Error(`Transaction signing failed: ${error.message}`);
    }
}

// Sign with Leather wallet
async function signWithLeather(transaction) {
    try {
        console.log('Signing with Leather...');
        
        // Serialize transaction to hex - using statically imported bytesToHex
        const txBytes = transaction.serialize();
        const txHex = bytesToHex(txBytes);
        
        console.log('Transaction serialized to hex');
        console.log('Hex length:', txHex.length);

        // Request signature from Leather
        const response = await window.LeatherProvider.request('stx_signTransaction', {
            txHex: txHex,
            network: CONFIG.NETWORK
        });

        console.log('Leather response:', response);

        if (!response || !response.result) {
            throw new Error('No response from Leather wallet');
        }

        // Get signed transaction hex
        const signedTxHex = response.result.txHex || response.result;
        
        console.log('Got signed transaction, broadcasting...');

        // Broadcast the transaction
        const txId = await broadcastTransaction(signedTxHex);
        
        console.log('Broadcast successful, txId:', txId);
        
        return txId;

    } catch (error) {
        console.error('Leather signing error:', error);
        throw error;
    }
}

// Sign with Xverse wallet
async function signWithXverse(transaction) {
    try {
        console.log('Signing with Xverse...');

        // Xverse handles signing and broadcasting internally
        const response = await window.XverseProviders.StacksProvider.request('stx_signTransaction', {
            transaction: transaction,
            network: CONFIG.NETWORK === 'mainnet' ? 'mainnet' : 'testnet'
        });

        console.log('Xverse response:', response);

        if (!response || !response.result) {
            throw new Error('No response from Xverse wallet');
        }

        // Xverse typically returns the txId directly after broadcasting
        const txId = response.result.txid || response.result.txId || response.result;
        
        console.log('Transaction signed and broadcast by Xverse, txId:', txId);
        
        return txId;

    } catch (error) {
        console.error('Xverse signing error:', error);
        throw error;
    }
}

// Broadcast transaction to the network
async function broadcastTransaction(txHex) {
    try {
        console.log('Broadcasting transaction...');
        console.log('API endpoint:', `${CONFIG.STACKS_API}/v2/transactions`);

        // Convert hex to bytes
        const txBytes = hexToBytes(txHex);
        
        const response = await fetch(`${CONFIG.STACKS_API}/v2/transactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream'
            },
            body: txBytes
        });

        console.log('Broadcast response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Broadcast error response:', errorText);
            throw new Error(`Broadcast failed: ${errorText}`);
        }

        const txId = await response.text();
        // Remove quotes if present
        const cleanTxId = txId.replace(/"/g, '').trim();
        
        console.log('Transaction broadcast successful');
        console.log('Transaction ID:', cleanTxId);
        
        return cleanTxId;

    } catch (error) {
        console.error('Broadcast error:', error);
        throw error;
    }
}

// Helper: Convert hex string to Uint8Array
function hexToBytes(hex) {
    // Remove any 0x prefix
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
    
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
        bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
    }
    return bytes;
}

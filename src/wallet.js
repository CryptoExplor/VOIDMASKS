import { CONFIG, utils } from './config.js';
import { updateUIState } from './ui.js';
import { mintNFT } from './contract.js';

// Global wallet state
let walletState = {
    isConnected: false,
    address: null,
    provider: null
};

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
        const response = await provider.request('getAddresses');
        
        if (response.result) {
            const addresses = response.result.addresses;
            const address = addresses[0].address;
            
            walletState = {
                isConnected: true,
                address: address,
                provider: 'leather'
            };
            
            updateUIState('connected', walletState);
            console.log('Connected to Leather wallet:', address);
        }
    } catch (error) {
        throw new Error(`Leather connection failed: ${error.message}`);
    }
}

// Connect to Xverse wallet
async function connectXverse() {
    const provider = window.XverseProviders.StacksProvider;
    
    if (!provider) {
        throw new Error('Xverse wallet not found');
    }
    
    try {
        const response = await provider.getAddresses();
        
        if (response && response.addresses) {
            const address = response.addresses[0].address;
            
            walletState = {
                isConnected: true,
                address: address,
                provider: 'xverse'
            };
            
            updateUIState('connected', walletState);
            console.log('Connected to Xverse wallet:', address);
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

// Sign and broadcast transaction
export async function signTransaction(tx, provider) {
    try {
        let signedTx;
        
        if (provider === 'leather') {
            const response = await window.LeatherProvider.request('stx_signTransaction', {
                tx: tx.serialize(),
                network: CONFIG.NETWORK
            });
            signedTx = response.result;
        } else if (provider === 'xverse') {
            const response = await window.XverseProviders.StacksProvider.signTransaction(tx);
            signedTx = response;
        }
        
        // Broadcast transaction
        const broadcastResponse = await fetch(`${CONFIG.STACKS_API}/v2/transactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream'
            },
            body: signedTx
        });
        
        if (!broadcastResponse.ok) {
            throw new Error('Failed to broadcast transaction');
        }
        
        const txId = await broadcastResponse.text();
        return txId;
    } catch (error) {
        throw new Error(`Transaction signing failed: ${error.message}`);
    }
}
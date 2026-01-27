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

// Sign and broadcast transaction - FIXED VERSION
export async function signTransaction(transaction, provider) {
    try {
        console.log('Signing transaction with provider:', provider);

        if (provider === 'leather') {
            // Leather wallet signing
            const { bytesToHex } = await import('@stacks/common');
            
            const txHex = bytesToHex(transaction.serialize());
            
            console.log('Requesting signature from Leather...');
            
            const response = await window.LeatherProvider.request('stx_signTransaction', {
                txHex: txHex,
                network: CONFIG.NETWORK
            });

            if (!response || !response.result) {
                throw new Error('No response from wallet');
            }

            console.log('Transaction signed, broadcasting...');
            
            // Broadcast the signed transaction
            const signedTxHex = response.result.txHex || response.result;
            
            const broadcastResponse = await fetch(`${CONFIG.STACKS_API}/v2/transactions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/octet-stream'
                },
                body: hexToBytes(signedTxHex)
            });

            if (!broadcastResponse.ok) {
                const errorText = await broadcastResponse.text();
                console.error('Broadcast error:', errorText);
                throw new Error(`Failed to broadcast transaction: ${errorText}`);
            }

            const txId = await broadcastResponse.text();
            const cleanTxId = txId.replace(/"/g, '');
            
            console.log('Transaction broadcast successful:', cleanTxId);
            return cleanTxId;

        } else if (provider === 'xverse') {
            // Xverse wallet signing
            console.log('Requesting signature from Xverse...');
            
            const response = await window.XverseProviders.StacksProvider.request('stx_signTransaction', {
                transaction: transaction,
                network: CONFIG.NETWORK === 'mainnet' ? 'mainnet' : 'testnet'
            });

            if (!response || !response.result) {
                throw new Error('No response from wallet');
            }

            console.log('Transaction signed by Xverse');
            
            const txId = response.result.txid || response.result.txId;
            
            if (!txId) {
                // If no txId in response, it might have been broadcast already
                console.log('No txId in response, transaction might be auto-broadcast');
                return 'pending';
            }

            return txId;
        }

        throw new Error('Unsupported wallet provider');

    } catch (error) {
        console.error('Transaction signing error:', error);
        console.error('Error details:', error.message);
        throw new Error(`Transaction signing failed: ${error.message}`);
    }
}

// Helper function to convert hex string to Uint8Array
function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

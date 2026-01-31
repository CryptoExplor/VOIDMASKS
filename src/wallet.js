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

// Address polling interval
let addressCheckInterval = null;
let isCheckingAddress = false; // Prevent concurrent checks

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

// Get current address from wallet (NON-INTRUSIVE - no popups)
async function getCurrentAddressFromWallet() {
    // Prevent concurrent checks
    if (isCheckingAddress) return null;
    isCheckingAddress = true;
    
    try {
        if (walletState.provider === 'leather' && window.LeatherProvider) {
            // Leather: Use stx_getAddresses instead of getAddresses to avoid popups
            try {
                const response = await window.LeatherProvider.request('stx_getAddresses');
                
                if (response && response.result && response.result.addresses) {
                    const stacksAddress = response.result.addresses.find(
                        addr => addr.type === 'stacks' || addr.symbol === 'STX'
                    );
                    return stacksAddress ? stacksAddress.address : null;
                }
            } catch (err) {
                // If stx_getAddresses doesn't work, silently fail
                console.debug('Could not get address silently:', err.message);
                return null;
            }
        } else if (walletState.provider === 'xverse' && window.XverseProviders?.StacksProvider) {
            // Xverse: Check if we can get address without prompting
            // For now, return null to avoid popup spam
            // Xverse doesn't have a silent way to check address changes
            return null;
        }
    } catch (error) {
        console.debug('Error getting current address:', error);
        return null;
    } finally {
        isCheckingAddress = false;
    }
    
    return null;
}

// Check if address has changed
async function checkAddressChange() {
    if (!walletState.isConnected) return;
    
    const currentAddress = await getCurrentAddressFromWallet();
    
    // Only update if we got a valid address and it's different
    if (currentAddress && currentAddress !== walletState.address) {
        console.log('🔄 Address changed detected!');
        console.log('Old:', walletState.address);
        console.log('New:', currentAddress);
        
        // Update wallet state
        walletState.address = currentAddress;
        saveWalletState();
        
        // Notify UI of change
        updateUIState('connected', walletState);
    }
}

// Start polling for address changes (Leather only, Xverse disabled to avoid popups)
function startAddressPolling() {
    if (addressCheckInterval) {
        clearInterval(addressCheckInterval);
    }
    
    // Only enable polling for Leather wallet
    if (walletState.provider !== 'leather') {
        console.log('⏸️  Address polling disabled for', walletState.provider);
        return;
    }
    
    console.log('📡 Starting address polling (Leather only)...');
    
    // Check every 5 seconds (reduced frequency to be less intrusive)
    addressCheckInterval = setInterval(() => {
        checkAddressChange();
    }, 5000);
}

// Stop polling for address changes
function stopAddressPolling() {
    if (addressCheckInterval) {
        console.log('🛑 Stopping address polling...');
        clearInterval(addressCheckInterval);
        addressCheckInterval = null;
    }
}

// Initialize wallet on page load
export function initializeWallet() {
    const savedState = loadWalletState();
    if (savedState && savedState.isConnected) {
        walletState = savedState;
        
        // Start polling for address changes (Leather only)
        startAddressPolling();
        
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
            
            // Start polling for address changes (Leather only)
            startAddressPolling();
            
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
            
            // Polling disabled for Xverse to avoid popups
            console.log('⚠️  Note: Automatic address detection disabled for Xverse');
            console.log('💡 Please reconnect if you switch accounts');
            
            updateUIState('connected', walletState);
            console.log(`Connected to Xverse wallet (${CONFIG.NETWORK}):`, address);
        }
    } catch (error) {
        throw new Error(`Xverse connection failed: ${error.message}`);
    }
}

// Disconnect wallet
export function disconnectWallet() {
    // Stop polling
    stopAddressPolling();
    
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

        // Parse contract address - handle undefined gracefully
        let contractAddress, contractName;
        
        if (!CONFIG.CONTRACT_ADDRESS) {
            throw new Error('Contract address not configured');
        }

        if (CONFIG.CONTRACT_ADDRESS.includes('.')) {
            const parts = CONFIG.CONTRACT_ADDRESS.split('.');
            contractAddress = parts[0];
            contractName = parts[1];
        } else {
            contractAddress = CONFIG.CONTRACT_ADDRESS;
            contractName = CONFIG.CONTRACT_NAME;
        }

        if (!contractAddress || !contractName) {
            throw new Error('Invalid contract configuration');
        }

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

// Sign with Leather - CORRECTED API FORMAT
async function signWithLeather(contractAddress, contractName) {
    try {
        console.log('Requesting Leather to sign transaction...');

        // Leather expects "contract" as a single string in "ADDRESS.CONTRACT" format
        const contractId = `${contractAddress}.${contractName}`;
        console.log('Contract ID:', contractId);

        const requestPayload = {
            contract: contractId,  // Combined format, not separate fields
            functionName: 'mint',
            functionArgs: [],
            network: CONFIG.NETWORK,
        };

        console.log('Request payload:', requestPayload);

        // Leather's stx_callContract method
        const result = await window.LeatherProvider.request('stx_callContract', requestPayload);

        console.log('Leather response:', result);

        // Check for JSON-RPC error response
        if (result && result.error) {
            console.error('Leather returned error:', result.error);
            const errorMessage = result.error.message || result.error.code || 'Unknown error from Leather';
            throw new Error(errorMessage);
        }

        if (!result || !result.result) {
            throw new Error('No response from Leather wallet');
        }

        // Extract transaction ID
        const txId = result.result.txId || result.result.txid || result.result;
        console.log('Transaction ID:', txId);

        return txId;
    } catch (error) {
        console.error('Leather signing error:', error);
        
        // Handle different error types
        if (error && typeof error === 'object') {
            // JSON-RPC error object
            if (error.error && error.error.message) {
                throw new Error(`Leather error: ${error.error.message}`);
            }
            // Standard Error object
            if (error.message) {
                if (error.message.toLowerCase().includes('reject') || 
                    error.message.toLowerCase().includes('cancel')) {
                    throw new Error('Transaction cancelled by user');
                }
                throw new Error(`Leather signing failed: ${error.message}`);
            }
        }
        
        // Fallback for unknown error types
        throw new Error('Leather signing failed: Unknown error');
    }
}

// Sign with Xverse - USES XVERSE'S NATIVE API WITH PROPER ERROR HANDLING
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

        // Check for error response
        if (result && result.error) {
            console.error('Xverse returned error:', result.error);
            const errorMessage = result.error.message || result.error.code || 'Unknown error from Xverse';
            throw new Error(errorMessage);
        }

        if (!result || !result.result) {
            throw new Error('No response from Xverse wallet');
        }

        // Extract transaction ID
        const txId = result.result.txid || result.result.txId || result.result;
        console.log('Transaction ID:', txId);

        return txId;
    } catch (error) {
        console.error('Xverse signing error:', error);
        
        // Handle different error types
        if (error && typeof error === 'object') {
            // JSON-RPC error object
            if (error.error && error.error.message) {
                throw new Error(`Xverse error: ${error.error.message}`);
            }
            // Standard Error object
            if (error.message) {
                if (error.message.toLowerCase().includes('reject') || 
                    error.message.toLowerCase().includes('cancel')) {
                    throw new Error('Transaction cancelled by user');
                }
                throw new Error(`Xverse signing failed: ${error.message}`);
            }
        }
        
        // Fallback for unknown error types
        throw new Error('Xverse signing failed: Unknown error');
    }
}

// Legacy function for compatibility with contract.js
export async function signTransaction(txOptions, senderAddress, provider) {
    console.log('=== LEGACY SIGN TRANSACTION (NOT USED) ===');
    console.log('Use executeMint() instead');
    throw new Error('This function is deprecated. Use executeMint() instead.');
}

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

// Event listener cleanup functions
let accountChangeListeners = [];

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

// Handle account change
async function handleAccountChange(newAddress) {
    console.log('Account changed detected:', newAddress);
    
    if (!newAddress) {
        console.log('No address provided, disconnecting...');
        disconnectWallet();
        return;
    }
    
    // Update wallet state with new address
    walletState.address = newAddress;
    saveWalletState();
    
    // Update UI with new address
    updateUIState('connected', walletState);
    
    console.log('Wallet address updated to:', newAddress);
}

// Setup account change listeners for Leather
function setupLeatherListeners() {
    if (!window.LeatherProvider) return;
    
    console.log('Setting up Leather account change listeners...');
    
    // Leather uses 'accountsChanged' event
    const listener = async (event) => {
        console.log('Leather accountsChanged event:', event);
        
        if (event.detail && event.detail.addresses) {
            const stacksAddress = event.detail.addresses.find(
                addr => addr.type === 'stacks' || addr.symbol === 'STX'
            );
            
            if (stacksAddress) {
                await handleAccountChange(stacksAddress.address);
            }
        }
    };
    
    window.addEventListener('accountsChanged', listener);
    accountChangeListeners.push(() => window.removeEventListener('accountsChanged', listener));
}

// Setup account change listeners for Xverse
function setupXverseListeners() {
    if (!window.XverseProviders?.StacksProvider) return;
    
    console.log('Setting up Xverse account change listeners...');
    
    // Xverse uses message events
    const listener = async (event) => {
        if (event.data && event.data.method === 'accountChange') {
            console.log('Xverse account change event:', event.data);
            
            if (event.data.params && event.data.params.address) {
                await handleAccountChange(event.data.params.address);
            }
        }
    };
    
    window.addEventListener('message', listener);
    accountChangeListeners.push(() => window.removeEventListener('message', listener));
}

// Cleanup all event listeners
function cleanupListeners() {
    console.log('Cleaning up wallet listeners...');
    accountChangeListeners.forEach(cleanup => cleanup());
    accountChangeListeners = [];
}

// Initialize wallet on page load
export function initializeWallet() {
    const savedState = loadWalletState();
    if (savedState && savedState.isConnected) {
        walletState = savedState;
        
        // Setup listeners based on provider
        if (savedState.provider === 'leather') {
            setupLeatherListeners();
        } else if (savedState.provider === 'xverse') {
            setupXverseListeners();
        }
        
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
            
            // Setup account change listeners
            setupLeatherListeners();
            
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
            
            // Setup account change listeners
            setupXverseListeners();
            
            updateUIState('connected', walletState);
            console.log(`Connected to Xverse wallet (${CONFIG.NETWORK}):`, address);
        }
    } catch (error) {
        throw new Error(`Xverse connection failed: ${error.message}`);
    }
}

// Disconnect wallet
export function disconnectWallet() {
    // Cleanup listeners
    cleanupListeners();
    
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

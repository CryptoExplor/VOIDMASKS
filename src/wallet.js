import { CONFIG } from './config.js';
import { updateUIState } from './ui.js';

// ============================================
// WALLET STATE (trust local until reconnect)
// ============================================

let walletState = {
    isConnected: false,
    address: null,
    provider: null,
    network: null
};

const STORAGE_KEY = 'voidmasks_wallet_state';

// ============================================
// PERSISTENCE (localStorage)
// ============================================

function loadWalletState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
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

function saveWalletState() {
    try {
        // Ensure network is always saved
        const stateToSave = {
            ...walletState,
            network: CONFIG.NETWORK
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (error) {
        console.error('Failed to save wallet state:', error);
    }
}

function clearWalletState() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.error('Failed to clear wallet state:', error);
    }
}

// ============================================
// ADDRESS CHANGE DETECTION (on user action only)
// ============================================

let isCheckingAddress = false;
let addressCheckPromise = null;

async function checkForAddressChange() {
    // Prevent concurrent checks
    if (isCheckingAddress || !walletState.isConnected) {
        return addressCheckPromise;
    }

    isCheckingAddress = true;
    addressCheckPromise = (async () => {
        try {
            let currentAddress = null;

            // Try to get current address from wallet
            if (walletState.provider === 'leather' && window.LeatherProvider) {
                try {
                    const response = await window.LeatherProvider.request('getAddresses', {
                        network: CONFIG.NETWORK === 'mainnet' ? 'mainnet' : 'testnet'
                    });

                    if (response.result && response.result.addresses) {
                        const stacksAddress = response.result.addresses.find(
                            addr => addr.type === 'stacks' || addr.symbol === 'STX'
                        );
                        currentAddress = stacksAddress ? stacksAddress.address : null;
                    }
                } catch (err) {
                    console.debug('Could not check Leather address:', err.message);
                }
            } else if (walletState.provider === 'xverse' && window.XverseProviders?.StacksProvider) {
                try {
                    const response = await window.XverseProviders.StacksProvider.request('getAddresses', {
                        purposes: ['stacks'],
                        message: 'Verify wallet address',
                        network: {
                            type: CONFIG.NETWORK === 'mainnet' ? 'mainnet' : 'testnet'
                        }
                    });

                    if (response && response.addresses) {
                        const stacksAddr = response.addresses.find(addr => addr.purpose === 'stacks');
                        currentAddress = stacksAddr ? stacksAddr.address : null;
                    }
                } catch (err) {
                    console.debug('Could not check Xverse address:', err.message);
                }
            }

            // If we got an address and it's different, disconnect
            if (currentAddress && currentAddress !== walletState.address) {
                console.log('⚠️ Wallet address changed!');
                console.log('Expected:', walletState.address);
                console.log('Current:', currentAddress);
                console.log('🔌 Auto-disconnecting...');
                
                // Auto-disconnect
                disconnectWallet();
                
                // Notify user
                alert('Your wallet address has changed. Please reconnect your wallet.');
            }
        } catch (error) {
            console.debug('Error checking address:', error);
        } finally {
            isCheckingAddress = false;
            addressCheckPromise = null;
        }
    })();

    return addressCheckPromise;
}

// Check address when user returns to tab (not on timer)
function setupVisibilityListener() {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && walletState.isConnected) {
            console.log('👀 User returned - checking wallet address...');
            // Small delay to avoid race conditions
            setTimeout(async () => {
                try {
                    await checkForAddressChange();
                } catch (error) {
                    console.error('Error checking address on visibility change:', error);
                }
            }, 1000);
        }
    });
}

// ============================================
// INITIALIZATION (restore from localStorage)
// ============================================

export function initializeWallet() {
    const savedState = loadWalletState();
    if (savedState && savedState.isConnected) {
        walletState = savedState;
        updateUIState('connected', walletState);
        console.log('✅ Restored wallet:', walletState.address);
    }
    
    // Set up visibility listener for address change detection
    setupVisibilityListener();
}

// ============================================
// WALLET DETECTION
// ============================================

export function isWalletInstalled(walletType) {
    try {
        switch (walletType) {
            case 'leather':
                return typeof window.LeatherProvider !== 'undefined' && 
                       typeof window.LeatherProvider.request === 'function';
            case 'xverse':
                return typeof window.XverseProviders?.StacksProvider !== 'undefined' &&
                       typeof window.XverseProviders.StacksProvider.request === 'function';
            default:
                return false;
        }
    } catch (error) {
        console.error('Error checking wallet installation:', error);
        return false;
    }
}

// ============================================
// CONNECT WALLET (ask once, trust thereafter)
// ============================================

export async function connectWallet() {
    try {
        if (isWalletInstalled('leather')) {
            await connectLeather();
        } else if (isWalletInstalled('xverse')) {
            await connectXverse();
        } else {
            throw new Error('No supported wallet found. Please install Leather or Xverse.');
        }
    } catch (error) {
        console.error('❌ Connection failed:', error);
        alert(`Connection failed: ${error.message}`);
    }
}

// Connect to Leather
async function connectLeather() {
    const provider = window.LeatherProvider;
    if (!provider) {
        throw new Error('Leather wallet not found');
    }

    try {
        const response = await provider.request('getAddresses', {
            network: CONFIG.NETWORK === 'mainnet' ? 'mainnet' : 'testnet'
        });

        if (response.result) {
            const addresses = response.result.addresses;
            const stacksAddress = addresses.find(addr => addr.type === 'stacks' || addr.symbol === 'STX');

            if (!stacksAddress) {
                throw new Error('No Stacks address found');
            }

            walletState = {
                isConnected: true,
                address: stacksAddress.address,
                provider: 'leather',
                network: CONFIG.NETWORK
            };

            saveWalletState();
            updateUIState('connected', walletState);
            console.log('✅ Connected (Leather):', stacksAddress.address);
        }
    } catch (error) {
        throw new Error(`Leather connection failed: ${error.message}`);
    }
}

// Connect to Xverse
async function connectXverse() {
    const provider = window.XverseProviders?.StacksProvider;
    if (!provider) {
        throw new Error('Xverse wallet not found');
    }

    try {
        const response = await provider.request('getAddresses', {
            purposes: ['stacks'],
            message: 'Connect to VOIDMASKS',
            network: {
                type: CONFIG.NETWORK === 'mainnet' ? 'mainnet' : 'testnet'
            }
        });

        if (response && response.addresses) {
            const stacksAddr = response.addresses.find(addr => addr.purpose === 'stacks');

            if (!stacksAddr) {
                throw new Error('No Stacks address found');
            }

            walletState = {
                isConnected: true,
                address: stacksAddr.address,
                provider: 'xverse',
                network: CONFIG.NETWORK
            };

            saveWalletState();
            updateUIState('connected', walletState);
            console.log('✅ Connected (Xverse):', stacksAddr.address);
        }
    } catch (error) {
        throw new Error(`Xverse connection failed: ${error.message}`);
    }
}

// ============================================
// DISCONNECT
// ============================================

export function disconnectWallet() {
    walletState = {
        isConnected: false,
        address: null,
        provider: null,
        network: null
    };

    clearWalletState();
    updateUIState('disconnected');
    console.log('🔌 Wallet disconnected');
}

// ============================================
// STATE GETTER
// ============================================

export function getWalletState() {
    return { ...walletState };
}

// ============================================
// MINT / SIGN TRANSACTION
// ============================================

export async function executeMint() {
    if (!walletState.isConnected) {
        throw new Error('Wallet not connected');
    }

    try {
        console.log('🎨 Minting NFT...');
        console.log('Wallet:', walletState.provider);
        console.log('Address:', walletState.address);
        console.log('Network:', CONFIG.NETWORK);

        // Parse contract
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

        // Sign transaction
        let txId;
        if (walletState.provider === 'leather') {
            txId = await signWithLeather(contractAddress, contractName);
        } else if (walletState.provider === 'xverse') {
            txId = await signWithXverse(contractAddress, contractName);
        } else {
            throw new Error('Unknown wallet provider');
        }

        console.log('✅ Mint successful! TX:', txId);
        return { success: true, txId };
    } catch (error) {
        console.error('❌ Mint failed:', error);
        throw error;
    }
}

// Sign with Leather
async function signWithLeather(contractAddress, contractName) {
    try {
        const contractId = `${contractAddress}.${contractName}`;
        
        const result = await window.LeatherProvider.request('stx_callContract', {
            contract: contractId,
            functionName: 'mint',
            functionArgs: [],
            network: CONFIG.NETWORK === 'mainnet' ? 'mainnet' : 'testnet',
        });

        if (result && result.error) {
            throw new Error(result.error.message || result.error.code || 'Leather error');
        }

        if (!result || !result.result) {
            throw new Error('No response from Leather');
        }

        // Extract transaction ID with strict validation
        const txId = result.result.txId || result.result.txid;
        if (!txId || typeof txId !== 'string') {
            throw new Error('Invalid transaction ID format from Leather');
        }
        
        return txId;
    } catch (error) {
        if (error.message?.toLowerCase().includes('reject') || 
            error.message?.toLowerCase().includes('cancel')) {
            throw new Error('Transaction cancelled by user');
        }
        throw new Error(`Leather signing failed: ${error.message}`);
    }
}

// Sign with Xverse
async function signWithXverse(contractAddress, contractName) {
    try {
        const result = await window.XverseProviders.StacksProvider.request('stx_callContract', {
            contractAddress: contractAddress,
            contractName: contractName,
            functionName: 'mint',
            functionArgs: [],
            network: CONFIG.NETWORK === 'mainnet' ? 'mainnet' : 'testnet',
        });

        if (result && result.error) {
            throw new Error(result.error.message || result.error.code || 'Xverse error');
        }

        if (!result || !result.result) {
            throw new Error('No response from Xverse');
        }

        // Extract transaction ID with strict validation
        const txId = result.result.txid || result.result.txId;
        if (!txId || typeof txId !== 'string') {
            throw new Error('Invalid transaction ID format from Xverse');
        }
        
        return txId;
    } catch (error) {
        if (error.message?.toLowerCase().includes('reject') || 
            error.message?.toLowerCase().includes('cancel')) {
            throw new Error('Transaction cancelled by user');
        }
        throw new Error(`Xverse signing failed: ${error.message}`);
    }
}

// ============================================
// DEPRECATED (kept for compatibility)
// ============================================

export async function signTransaction() {
    console.warn('⚠️ signTransaction() is deprecated. Use executeMint() instead.');
    return executeMint();
}

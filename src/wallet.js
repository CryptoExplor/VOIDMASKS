import { CONFIG, utils } from './config.js';
import { updateUIState } from './ui.js';

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

// Execute mint transaction - SIMPLIFIED VERSION
export async function executeMint() {
    if (!walletState.isConnected) {
        throw new Error('Wallet not connected');
    }

    try {
        console.log('Starting mint transaction...');
        console.log('Wallet provider:', walletState.provider);
        console.log('Network:', CONFIG.NETWORK);

        // Import Stacks.js
        const {
            makeContractCall,
            AnchorMode,
            PostConditionMode,
            StacksTestnet,
            StacksMainnet,
            broadcastTransaction
        } = await import('@stacks/transactions');

        // Determine network
        const network = CONFIG.NETWORK === 'mainnet' 
            ? new StacksMainnet() 
            : new StacksTestnet();

        // Create transaction options
        const txOptions = {
            contractAddress: CONFIG.CONTRACT_ADDRESS,
            contractName: CONFIG.CONTRACT_NAME,
            functionName: 'mint',
            functionArgs: [],
            network: network,
            anchorMode: AnchorMode.Any,
            postConditionMode: PostConditionMode.Allow,
            fee: 200000, // 0.2 STX
        };

        console.log('Transaction options:', txOptions);

        // Use wallet's native contract call method
        if (walletState.provider === 'leather') {
            console.log('Using Leather contract call...');
            
            const response = await window.LeatherProvider.request('stx_callContract', {
                contract: `${CONFIG.CONTRACT_ADDRESS}.${CONFIG.CONTRACT_NAME}`,
                functionName: 'mint',
                functionArgs: [],
                network: CONFIG.NETWORK,
                postConditions: [],
                sponsored: false
            });

            if (response && response.result) {
                const txId = response.result.txid || response.result.txId || response.result;
                console.log('Mint transaction submitted:', txId);
                
                return {
                    success: true,
                    txId: txId,
                    tokenId: null
                };
            }

            throw new Error('No transaction ID received from wallet');

        } else if (walletState.provider === 'xverse') {
            console.log('Using Xverse contract call...');
            
            const response = await window.XverseProviders.StacksProvider.request('stx_callContract', {
                contract: `${CONFIG.CONTRACT_ADDRESS}.${CONFIG.CONTRACT_NAME}`,
                functionName: 'mint',
                functionArgs: [],
                network: CONFIG.NETWORK === 'mainnet' ? 'mainnet' : 'testnet',
                postConditions: []
            });

            if (response && response.result) {
                const txId = response.result.txid || response.result.txId || response.result;
                console.log('Mint transaction submitted:', txId);
                
                return {
                    success: true,
                    txId: txId,
                    tokenId: null
                };
            }

            throw new Error('No transaction ID received from wallet');
        }

        throw new Error('Unsupported wallet provider');

    } catch (error) {
        console.error('Mint transaction failed:', error);
        console.error('Error stack:', error.stack);
        throw new Error(`Mint failed: ${error.message}`);
    }
}

// Sign transaction helper (kept for compatibility)
export async function signTransaction(transaction, provider) {
    // This is now unused but kept for backwards compatibility
    console.warn('signTransaction called but not used - using native wallet methods instead');
    return 'unused';
}

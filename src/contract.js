import { CONFIG } from './config.js';
import { signTransaction } from './wallet.js';
import { generateSVGFromTokenId } from './svg.js';

// Parse contract address - it's in format "ADDRESS.CONTRACT_NAME"
const parseContractAddress = () => {
    const parts = CONFIG.CONTRACT_ADDRESS.split('.');
    if (parts.length === 2) {
        return {
            address: parts[0],
            name: parts[1]
        };
    }
    return {
        address: CONFIG.CONTRACT_ADDRESS,
        name: CONFIG.CONTRACT_NAME
    };
};

// Read-only contract calls
export async function getTotalSupply() {
    try {
        const { address, name } = parseContractAddress();
        const response = await fetch(
            `${CONFIG.STACKS_API}/v2/contracts/call-read/${address}/${name}/get-total-supply`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sender: 'SP000000000000000000002Q6VF78', arguments: [] })
            }
        );

        const result = await response.json();

        // Handle (ok uint) response
        if (result.result) {
            const match = result.result.match(/\(ok u(\d+)\)/);
            if (match) {
                return parseInt(match[1]);
            }
        }
        return 0;
    } catch (error) {
        console.error('Failed to get total supply:', error);
        return 0;
    }
}

export async function getOwnerOfToken(tokenId) {
    try {
        const { address, name } = parseContractAddress();
        const response = await fetch(
            `${CONFIG.STACKS_API}/v2/contracts/call-read/${address}/${name}/get-owner`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sender: 'SP000000000000000000002Q6VF78',
                    arguments: [`u${tokenId}`]
                })
            }
        );

        const result = await response.json();
        if (result.result && result.result.includes('none')) {
            return null;
        }
        // Extract principal from (ok (some principal))
        const principalMatch = result.result.match(/([S][TP][A-Z0-9]+)/);
        return principalMatch ? principalMatch[1] : null;
    } catch (error) {
        console.error('Failed to get token owner:', error);
        return null;
    }
}

export async function getTokenURI(tokenId) {
    try {
        const { address, name } = parseContractAddress();
        const response = await fetch(
            `${CONFIG.STACKS_API}/v2/contracts/call-read/${address}/${name}/get-token-uri`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sender: 'SP000000000000000000002Q6VF78',
                    arguments: [`u${tokenId}`]
                })
            }
        );

        const result = await response.json();
        if (result.result && result.result.includes('none')) {
            return null;
        }
        // Extract URI from response
        const uriMatch = result.result.match(/"([^"]+)"/);
        return uriMatch ? uriMatch[1] : null;
    } catch (error) {
        console.error('Failed to get token URI:', error);
        return null;
    }
}

export async function getLastTokenId() {
    try {
        const { address, name } = parseContractAddress();
        const response = await fetch(
            `${CONFIG.STACKS_API}/v2/contracts/call-read/${address}/${name}/get-last-token-id`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sender: 'SP000000000000000000002Q6VF78', arguments: [] })
            }
        );

        const result = await response.json();

        // Handle (ok uint) response
        if (result.result) {
            const match = result.result.match(/\(ok u(\d+)\)/);
            if (match) {
                return parseInt(match[1]);
            }
        }
        return 0;
    } catch (error) {
        console.error('Failed to get last token ID:', error);
        return 0;
    }
}

export async function getBalanceOf(owner) {
    try {
        const { address, name } = parseContractAddress();
        const response = await fetch(
            `${CONFIG.STACKS_API}/v2/contracts/call-read/${address}/${name}/get-balance`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sender: 'SP000000000000000000002Q6VF78',
                    arguments: [`'${owner}`]
                })
            }
        );

        const result = await response.json();

        // Handle (ok uint) response
        if (result.result) {
            const match = result.result.match(/\(ok u(\d+)\)/);
            if (match) {
                return parseInt(match[1]);
            }
        }
        return 0;
    } catch (error) {
        console.error('Failed to get balance:', error);
        return 0;
    }
}

// Get all tokens owned by an address
export async function getTokensByOwner(owner) {
    try {
        const balance = await getBalanceOf(owner);
        if (balance === 0) return [];

        const tokens = [];
        const lastTokenId = await getLastTokenId();

        // Check each token ID to see if it's owned by this address
        for (let i = 1; i <= lastTokenId && tokens.length < balance; i++) {
            const tokenOwner = await getOwnerOfToken(i);
            if (tokenOwner === owner) {
                tokens.push(i);
            }
        }

        return tokens;
    } catch (error) {
        console.error('Failed to get tokens by owner:', error);
        return [];
    }
}

// Mint NFT transaction - FIXED WITH PROPER IMPORTS
export async function mintNFT(senderAddress, provider) {
    try {
        console.log('Starting mint process...');
        console.log('Sender:', senderAddress);
        console.log('Provider:', provider);
        console.log('Network:', CONFIG.NETWORK);

        // Import the modules
        const txModule = await import('@stacks/transactions');
        const networkModule = await import('@stacks/network');

        // Access the actual exported classes/functions
        const makeContractCall = txModule.makeContractCall || txModule.default?.makeContractCall;
        const AnchorMode = txModule.AnchorMode || txModule.default?.AnchorMode;
        const PostConditionMode = txModule.PostConditionMode || txModule.default?.PostConditionMode;

        // Network classes come from @stacks/network now
        const StacksTestnet = networkModule.StacksTestnet || networkModule.default?.StacksTestnet;
        const StacksMainnet = networkModule.StacksMainnet || networkModule.default?.StacksMainnet;

        console.log('Loaded modules');
        console.log('makeContractCall:', typeof makeContractCall);
        console.log('AnchorMode:', typeof AnchorMode, AnchorMode);
        console.log('PostConditionMode:', typeof PostConditionMode, PostConditionMode);
        console.log('StacksTestnet:', typeof StacksTestnet);
        console.log('StacksMainnet:', typeof StacksMainnet);
        console.log('txModule keys:', Object.keys(txModule));
        console.log('networkModule keys:', Object.keys(networkModule));

        // Parse contract address
        const { address, name } = parseContractAddress();
        console.log('Contract address:', address);
        console.log('Contract name:', name);

        // Create network instance based on config
        let network;
        if (CONFIG.NETWORK === 'mainnet') {
            network = new StacksMainnet();
        } else {
            network = new StacksTestnet();
        }

        console.log('Network created:', network);

        // Build transaction options
        const txOptions = {
            contractAddress: address,
            contractName: name,
            functionName: 'mint',
            functionArgs: [],
            network: network,
            anchorMode: AnchorMode.Any,
            postConditionMode: PostConditionMode.Allow,
            fee: BigInt(200000), // Explicitly use BigInt constructor
        };

        console.log('Transaction options prepared:', txOptions);

        // Create the unsigned transaction
        const transaction = await makeContractCall(txOptions);

        console.log('Unsigned transaction created');
        console.log('Transaction type:', typeof transaction);

        // Sign and broadcast
        const txId = await signTransaction(transaction, provider);

        console.log('Transaction signed and broadcast, txId:', txId);

        return {
            success: true,
            txId: txId,
            tokenId: null
        };

    } catch (error) {
        console.error('=== MINT ERROR ===');
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('Error name:', error.name);
        console.error('Full error:', error);
        throw new Error(`Mint failed: ${error.message}`);
    }
}

// Generate SVG for token (client-side fallback)
export function generateTokenSVG(tokenId) {
    return generateSVGFromTokenId(tokenId);
}

// Poll for transaction confirmation
export async function waitForTransaction(txId, maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const response = await fetch(`${CONFIG.STACKS_API}/extended/v1/tx/${txId}`);
            const txData = await response.json();

            if (txData.tx_status === 'success') {
                return { confirmed: true, txData };
            } else if (txData.tx_status === 'abort_by_response' || txData.tx_status === 'abort_by_post_condition') {
                return { confirmed: false, error: 'Transaction failed' };
            }

            // Wait 10 seconds before next check
            await new Promise(resolve => setTimeout(resolve, 10000));
        } catch (error) {
            console.error('Error checking transaction status:', error);
        }
    }

    return { confirmed: false, error: 'Transaction timeout' };
}

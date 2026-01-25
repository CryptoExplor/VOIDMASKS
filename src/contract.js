import { CONFIG } from './config.js';
import { signTransaction } from './wallet.js';
import { generateSVGFromTokenId } from './svg.js';

// Contract address helper
const getContractAddress = () => `${CONFIG.CONTRACT_ADDRESS}.${CONFIG.CONTRACT_NAME}`;

// Read-only contract calls
export async function getTotalSupply() {
    try {
        const response = await fetch(
            `${CONFIG.STACKS_API}/v2/contracts/call-read/${CONFIG.CONTRACT_ADDRESS}/${CONFIG.CONTRACT_NAME}/total-supply`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sender: 'SP000000000000000000002Q6VF78' })
            }
        );

        const result = await response.json();
        return parseInt(result.result.replace('u', ''));
    } catch (error) {
        console.error('Failed to get total supply:', error);
        return 0;
    }
}

export async function getOwnerOfToken(tokenId) {
    try {
        const response = await fetch(
            `${CONFIG.STACKS_API}/v2/contracts/call-read/${CONFIG.CONTRACT_ADDRESS}/${CONFIG.CONTRACT_NAME}/get-owner`,
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
        if (result.result.includes('none')) {
            return null;
        }
        // Extract principal from (some principal)
        const principalMatch = result.result.match(/\(([^)]+)\)/);
        return principalMatch ? principalMatch[1] : null;
    } catch (error) {
        console.error('Failed to get token owner:', error);
        return null;
    }
}

export async function getTokenURI(tokenId) {
    try {
        const response = await fetch(
            `${CONFIG.STACKS_API}/v2/contracts/call-read/${CONFIG.CONTRACT_ADDRESS}/${CONFIG.CONTRACT_NAME}/get-token-uri`,
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
        if (result.result.includes('none')) {
            return null;
        }
        // Extract URI from (some "uri")
        const uriMatch = result.result.match(/"([^"]+)"/);
        return uriMatch ? uriMatch[1] : null;
    } catch (error) {
        console.error('Failed to get token URI:', error);
        return null;
    }
}

export async function getLastTokenId() {
    try {
        const response = await fetch(
            `${CONFIG.STACKS_API}/v2/contracts/call-read/${CONFIG.CONTRACT_ADDRESS}/${CONFIG.CONTRACT_NAME}/get-last-token-id`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sender: 'SP000000000000000000002Q6VF78' })
            }
        );

        const result = await response.json();
        return parseInt(result.result.replace('u', ''));
    } catch (error) {
        console.error('Failed to get last token ID:', error);
        return 0;
    }
}

export async function getBalanceOf(owner) {
    try {
        const response = await fetch(
            `${CONFIG.STACKS_API}/v2/contracts/call-read/${CONFIG.CONTRACT_ADDRESS}/${CONFIG.CONTRACT_NAME}/balance-of`,
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
        return parseInt(result.result.replace('u', ''));
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

// Mint NFT transaction
export async function mintNFT(senderAddress, provider) {
    try {
        // Import Stacks.js libraries dynamically to avoid bundling issues
        const { makeContractCall, AnchorMode, PostConditionMode, FungibleConditionCode,
            makeStandardSTXPostCondition, StacksMainnet, StacksTestnet } = await import('@stacks/transactions');

        // Determine network
        const network = CONFIG.NETWORK === 'mainnet' ? new StacksMainnet() : new StacksTestnet();

        // Create post condition (require 1 STX payment)
        const postCondition = makeStandardSTXPostCondition(
            senderAddress,
            FungibleConditionCode.Equal,
            CONFIG.MINT_FEE
        );

        // Create contract call transaction
        const txOptions = {
            contractAddress: CONFIG.CONTRACT_ADDRESS,
            contractName: CONFIG.CONTRACT_NAME,
            functionName: 'mint',
            functionArgs: [],
            senderKey: '', // Will be signed by wallet
            validateWithAbi: false,
            network: network,
            anchorMode: AnchorMode.Any,
            postConditionMode: PostConditionMode.Deny,
            postConditions: [postCondition],
            fee: 10000, // 0.01 STX fee
            nonce: undefined // Let wallet handle nonce
        };

        // Create unsigned transaction
        const transaction = await makeContractCall(txOptions);

        // Sign and broadcast transaction
        const txId = await signTransaction(transaction, provider);

        console.log(`Mint transaction submitted on ${CONFIG.NETWORK}:`, txId);

        return {
            success: true,
            txId: txId,
            tokenId: null // Will be determined after transaction confirmation
        };
    } catch (error) {
        console.error('Mint transaction failed:', error);
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
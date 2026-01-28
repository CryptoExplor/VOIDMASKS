import { CONFIG } from './config.js';
import { generateSVGFromTokenId } from './svg.js';

import { STACKS_MAINNET, STACKS_TESTNET } from '@stacks/network';
import {
    standardPrincipalCV,
    uintCV,
    cvToHex,
    hexToCV,
    cvToValue
} from '@stacks/transactions';

/* --------------------------------------------------
   Helpers
-------------------------------------------------- */

const READ_ONLY_SENDER = 'SP000000000000000000002Q6VF78';

const parseContractAddress = () => {
    // Handle both formats: "ADDRESS.CONTRACT" or just "ADDRESS"
    if (CONFIG.CONTRACT_ADDRESS.includes('.')) {
        const parts = CONFIG.CONTRACT_ADDRESS.split('.');
        return {
            address: parts[0],
            name: parts[1],
        };
    } else {
        return {
            address: CONFIG.CONTRACT_ADDRESS,
            name: CONFIG.CONTRACT_NAME,
        };
    }
};

const getNetwork = () => {
    return CONFIG.NETWORK === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET;
};

/**
 * Recursively flattens a Stacks JS CV value object to its raw primitive.
 * Handle cases where cvToValue returns { type: '...', value: ... }
 */
function flattenCV(val) {
    if (val && typeof val === 'object' && val !== null && 'value' in val) {
        return flattenCV(val.value);
    }
    return val;
}

/* --------------------------------------------------
   Read-only helpers (Hiro API SAFE)
-------------------------------------------------- */

async function callRead(functionName, args = []) {
    const { address, name } = parseContractAddress();

    const response = await fetch(
        `${CONFIG.STACKS_API}/v2/contracts/call-read/${address}/${name}/${functionName}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sender: READ_ONLY_SENDER,
                arguments: args,
            }),
        }
    );

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Contract call failed: ${text}`);
    }

    return response.json();
}

// FIXED: Parse both hex and text responses
function parseOkUInt(result) {
    // Try text format first: (ok u123)
    const textMatch = result?.match(/\(ok u(\d+)\)/);
    if (textMatch) {
        return Number(textMatch[1]);
    }

    // Try hex format: 0x070100000000000000000000000000000001
    if (result && result.startsWith('0x')) {
        try {
            // Decode hex to Clarity value
            const clarityValue = hexToCV(result);
            const jsValue = cvToValue(clarityValue);

            // Use flattenCV to get the actual number
            const flatValue = flattenCV(jsValue);
            return Number(flatValue) || 0;
        } catch (error) {
            console.error('Error parsing hex response:', error);
            return 0;
        }
    }

    return 0;
}

/* --------------------------------------------------
   Public Read-only API
-------------------------------------------------- */

export async function getTotalSupply() {
    try {
        const res = await callRead('get-total-supply');
        const supply = parseOkUInt(res.result);
        console.log('📊 Total Supply:', supply);
        return supply;
    } catch (error) {
        console.error('Failed to get total supply:', error);
        return 0;
    }
}

export async function getLastTokenId() {
    try {
        const res = await callRead('get-last-token-id');
        const lastId = parseOkUInt(res.result);
        console.log('📊 Last Token ID:', lastId);
        return lastId;
    } catch (error) {
        console.error('Failed to get last token ID:', error);
        return 0;
    }
}

export async function getOwnerOfToken(tokenId) {
    try {
        const res = await callRead('get-owner', [
            cvToHex(uintCV(tokenId)),
        ]);

        // Handle hex response
        if (res.result && res.result.startsWith('0x')) {
            try {
                const clarityValue = hexToCV(res.result);
                const jsValue = cvToValue(clarityValue);
                return flattenCV(jsValue) || null;
            } catch (error) {
                console.error('Error parsing owner hex:', error);
                return null;
            }
        }

        // Handle text response
        if (res.result.includes('none')) return null;

        const match = res.result.match(/([ST][A-Z0-9]{38})/);
        return match ? match[1] : null;
    } catch (error) {
        console.error(`Failed to get owner of token ${tokenId}:`, error);
        return null;
    }
}

export async function getTokenURI(tokenId) {
    try {
        const res = await callRead('get-token-uri', [
            cvToHex(uintCV(tokenId)),
        ]);

        // Handle hex response
        if (res.result && res.result.startsWith('0x')) {
            try {
                const clarityValue = hexToCV(res.result);
                const jsValue = cvToValue(clarityValue);
                return flattenCV(jsValue) || null;
            } catch (error) {
                console.error('Error parsing URI hex:', error);
                return null;
            }
        }

        // Handle text response
        if (res.result.includes('none')) return null;

        const match = res.result.match(/"(data:[^"]+)"/);
        return match ? match[1] : null;
    } catch (error) {
        console.error(`Failed to get token URI for ${tokenId}:`, error);
        return null;
    }
}

// FIXED: Don't rely on get-balance, iterate through all tokens
export async function getTokensByOwner(owner) {
    console.log('Fetching tokens for owner:', owner);

    try {
        const lastId = await getLastTokenId();
        console.log('Last token ID:', lastId);

        if (lastId === 0) {
            console.log('No tokens minted yet');
            return [];
        }

        const tokens = [];

        // Iterate through all token IDs to find owner's tokens
        for (let i = 1; i <= lastId; i++) {
            try {
                const tokenOwner = await getOwnerOfToken(i);
                console.log(`Token ${i} owner:`, tokenOwner);

                const ownerAddr = flattenCV(owner);
                const tokenOwnerAddr = flattenCV(tokenOwner);

                if (tokenOwnerAddr && ownerAddr &&
                    tokenOwnerAddr.toString().toLowerCase() === ownerAddr.toString().toLowerCase()) {
                    tokens.push(i);
                    console.log(`Found token ${i} owned by user`);
                }
            } catch (error) {
                console.error(`Error checking token ${i}:`, error);
            }
        }

        console.log('Total tokens found:', tokens);
        return tokens;

    } catch (error) {
        console.error('Failed to get tokens by owner:', error);
        return [];
    }
}

/* --------------------------------------------------
   MINT - DELEGATES TO WALLET
-------------------------------------------------- */

export async function mintNFT(senderAddress, provider) {
    try {
        console.log('=== MINT NFT (contract.js) ===');
        console.log('Note: This function now delegates to wallet.js executeMint()');
        console.log('Sender:', senderAddress);
        console.log('Provider:', provider);

        // Import executeMint dynamically to avoid circular dependency
        const { executeMint } = await import('./wallet.js');
        return await executeMint();

    } catch (error) {
        console.error('MINT FAILED:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        throw new Error(`Mint failed: ${error.message}`);
    }
}

/* --------------------------------------------------
   Client-side SVG fallback
-------------------------------------------------- */

export function generateTokenSVG(tokenId) {
    return generateSVGFromTokenId(tokenId);
}

/* --------------------------------------------------
   Tx confirmation helper
-------------------------------------------------- */

export async function waitForTransaction(txId, maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const res = await fetch(
                `${CONFIG.STACKS_API}/extended/v1/tx/${txId}`
            );

            if (!res.ok) {
                console.log(`Attempt ${i + 1}: Transaction not found yet`);
                await new Promise(r => setTimeout(r, 10_000));
                continue;
            }

            const tx = await res.json();

            if (tx.tx_status === 'success') {
                return { confirmed: true, tx };
            }

            if (
                tx.tx_status === 'abort_by_response' ||
                tx.tx_status === 'abort_by_post_condition'
            ) {
                return { confirmed: false, reason: tx.tx_status };
            }

            console.log(`Attempt ${i + 1}: Transaction status: ${tx.tx_status}`);
            await new Promise(r => setTimeout(r, 10_000));
        } catch (error) {
            console.error(`Error checking transaction ${txId}:`, error);
            await new Promise(r => setTimeout(r, 10_000));
        }
    }

    return { confirmed: false, timeout: true };
}

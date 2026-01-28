import { CONFIG } from './config.js';
import { generateSVGFromTokenId } from './svg.js';

import { STACKS_MAINNET, STACKS_TESTNET } from '@stacks/network';
import {
  standardPrincipalCV,
  uintCV,
  cvToHex,
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

function parseOkUInt(result) {
  const match = result?.match(/\(ok u(\d+)\)/);
  return match ? Number(match[1]) : 0;
}

/* --------------------------------------------------
   Public Read-only API
-------------------------------------------------- */

export async function getTotalSupply() {
  try {
    const res = await callRead('get-total-supply');
    return parseOkUInt(res.result);
  } catch (error) {
    console.error('Failed to get total supply:', error);
    return 0;
  }
}

export async function getLastTokenId() {
  try {
    const res = await callRead('get-last-token-id');
    return parseOkUInt(res.result);
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

    if (res.result.includes('none')) return null;

    const match = res.result.match(/"(data:[^"]+)"/);
    return match ? match[1] : null;
  } catch (error) {
    console.error(`Failed to get token URI for ${tokenId}:`, error);
    return null;
  }
}

export async function getBalanceOf(owner) {
  try {
    const res = await callRead('get-balance', [
      cvToHex(standardPrincipalCV(owner)),
    ]);

    return parseOkUInt(res.result);
  } catch (error) {
    console.error(`Failed to get balance for ${owner}:`, error);
    return 0;
  }
}

export async function getTokensByOwner(owner) {
  const balance = await getBalanceOf(owner);
  if (balance === 0) return [];

  const tokens = [];
  const lastId = await getLastTokenId();

  for (let i = 1; i <= lastId && tokens.length < balance; i++) {
    const tokenOwner = await getOwnerOfToken(i);
    if (tokenOwner === owner) tokens.push(i);
  }

  return tokens;
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

import { CONFIG } from './config.js';
import { signTransaction } from './wallet.js';
import { generateSVGFromTokenId } from './svg.js';

import { STACKS_MAINNET, STACKS_TESTNET } from '@stacks/network';
import {
  makeContractCall,
  AnchorMode,
  PostConditionMode,
  standardPrincipalCV,
  uintCV,
  cvToHex,
} from '@stacks/transactions';

/* --------------------------------------------------
   Helpers
-------------------------------------------------- */

const READ_ONLY_SENDER = 'SP000000000000000000002Q6VF78';

const parseContractAddress = () => {
  const parts = CONFIG.CONTRACT_ADDRESS.split('.');
  return {
    address: parts[0],
    name: parts[1] ?? CONFIG.CONTRACT_NAME,
  };
};

const network =
  CONFIG.NETWORK === 'mainnet'
    ? STACKS_MAINNET
    : STACKS_TESTNET;

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
    throw new Error(text);
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
  } catch {
    return 0;
  }
}

export async function getLastTokenId() {
  try {
    const res = await callRead('get-last-token-id');
    return parseOkUInt(res.result);
  } catch {
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
  } catch {
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
  } catch {
    return null;
  }
}

export async function getBalanceOf(owner) {
  try {
    const res = await callRead('get-balance', [
      cvToHex(standardPrincipalCV(owner)),
    ]);

    return parseOkUInt(res.result);
  } catch {
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
   MINT (FIXED – NO MAP ERROR)
-------------------------------------------------- */

export async function mintNFT(senderAddress, provider) {
  try {
    const { address, name } = parseContractAddress();

    const txOptions = {
      contractAddress: address,
      contractName: name,
      functionName: 'mint',

      // 🔑 REQUIRED — DO NOT REMOVE
      senderAddress: senderAddress,

      // 🔑 REQUIRED — MUST EXIST
      functionArgs: [],
      postConditions: [],

      network,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
    };

    const transaction = await makeContractCall(txOptions);

    const txId = await signTransaction(transaction, provider);

    return { success: true, txId };
  } catch (error) {
    console.error('MINT FAILED:', error);
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
    const res = await fetch(
      `${CONFIG.STACKS_API}/extended/v1/tx/${txId}`
    );

    const tx = await res.json();

    if (tx.tx_status === 'success') {
      return { confirmed: true, tx };
    }

    if (
      tx.tx_status === 'abort_by_response' ||
      tx.tx_status === 'abort_by_post_condition'
    ) {
      return { confirmed: false };
    }

    await new Promise(r => setTimeout(r, 10_000));
  }

  return { confirmed: false, timeout: true };
}


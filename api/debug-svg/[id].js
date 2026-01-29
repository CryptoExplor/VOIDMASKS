// API endpoint: /api/debug-svg/[id].js
// Tests each layer separately to diagnose concatenation issues

import { uintCV, cvToHex } from '@stacks/transactions';

async function callContractFunction(contractAddress, contractName, functionName, args = []) {
  const response = await fetch(
    `https://api.testnet.hiro.so/v2/contracts/call-read/${contractAddress}/${contractName}/${functionName}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: 'SP000000000000000000002Q6VF78',
        arguments: args
      })
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to call ${functionName}`);
  }
  
  return response.json();
}

function decodeHex(hexString) {
  if (!hexString.startsWith('0x')) return hexString;
  
  const hex = hexString.slice(2);
  let result = '';
  let startIndex = 0;
  
  // Find where SVG content starts
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.substr(i, 2), 16);
    if (byte === 0x3C) { // '<' character
      startIndex = i;
      break;
    }
  }
  
  // Decode from that point
  for (let i = startIndex; i < hex.length; i += 2) {
    const byte = parseInt(hex.substr(i, 2), 16);
    if (byte > 0) {
      result += String.fromCharCode(byte);
    }
  }
  
  // URL decode
  return result
    .replace(/%23/g, '#')
    .replace(/%27/g, "'")
    .replace(/%22/g, '"');
}

export default async function handler(req, res) {
  const { id } = req.query;
  const tokenId = parseInt(id);
  
  if (isNaN(tokenId) || tokenId < 1) {
    return res.status(400).json({ error: 'Invalid token ID' });
  }

  try {
    const contractAddress = process.env.CONTRACT_ADDRESS || 'ST1HCWN2BWA7HKY61AVPC0EKRB4TH84TMV26A4VRZ';
    const contractName = process.env.CONTRACT_NAME || 'test2';
    const tokenIdArg = cvToHex(uintCV(tokenId));

    // Get traits
    const traitsData = await callContractFunction(contractAddress, contractName, 'get-traits', [tokenIdArg]);
    
    // Get complete SVG
    const svgData = await callContractFunction(contractAddress, contractName, 'get-svg', [tokenIdArg]);
    const completeSvg = decodeHex(svgData.result);

    // Calculate trait values (same as contract)
    const e = tokenId % 10;
    const m = Math.floor(tokenId / 10) % 9;
    const a = Math.floor(tokenId / 90) % 8;
    const c = Math.floor(tokenId / 720) % 6;
    const s = Math.floor(tokenId / 4320) % 6;
    const p = Math.floor(tokenId / 25920) % 8;
    const b = Math.floor(tokenId / 207360) % 8;

    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
      tokenId,
      contractAddress,
      contractName,
      traits: {
        expression: e,
        mouth: m,
        aura: a,
        corruption: c,
        symbol: s,
        palette: p,
        background: b
      },
      completeSvg,
      svgLength: completeSvg.length,
      hasOpeningTag: completeSvg.includes('<svg'),
      hasClosingTag: completeSvg.includes('</svg>'),
      hasBackground: completeSvg.includes("fill='#000'") || completeSvg.includes("fill='#0a0a0f'"),
      hasBody: completeSvg.includes("fill='#eee'"),
      hasEyes: completeSvg.includes("x='22'"),
      hasMouth: completeSvg.includes("x='28' y='36'") || completeSvg.includes("x='26' y='36'"),
      hasAura: completeSvg.includes("stroke="),
      hasSymbol: completeSvg.includes("x='30' y='18'") || completeSvg.includes("cx='32'"),
      hasCorruption: completeSvg.includes("x='18' y='22'") || completeSvg.includes("x='40' y='22'"),
      analysis: {
        expectedTraits: `expression=${e}, mouth=${m}, aura=${a}, corruption=${c}, symbol=${s}, palette=${p}, background=${b}`,
        mouthShouldShow: m > 0,
        auraShouldShow: a > 0,
        symbolShouldShow: s > 0,
        corruptionShouldShow: c > 0
      }
    });

  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to debug SVG',
      details: error.message 
    });
  }
}

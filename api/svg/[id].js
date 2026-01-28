// API endpoint: /api/svg/[id].js - DIAGNOSTIC VERSION
// This version will show us what the contract is actually returning

import { uintCV, cvToHex } from '@stacks/transactions';

export default async function handler(req, res) {
  const { id } = req.query;

  // Validate token ID
  const tokenId = parseInt(id);
  if (isNaN(tokenId) || tokenId < 1) {
    return res.status(400).json({ error: 'Invalid token ID' });
  }

  try {
    // Get contract info from environment
    const network = process.env.NETWORK || 'testnet';
    const contractAddress = process.env.CONTRACT_ADDRESS || 'ST1HCWN2BWA7HKY61AVPC0EKRB4TH84TMV26A4VRZ';
    const contractName = process.env.CONTRACT_NAME || 'test2';
    const stacksApi = network === 'mainnet' 
      ? 'https://api.mainnet.hiro.so'
      : 'https://api.testnet.hiro.so';

    // Encode the token ID
    const tokenIdArg = cvToHex(uintCV(tokenId));

    console.log('=== SVG FETCH DEBUG ===');
    console.log('Token ID:', tokenId);
    console.log('Contract:', `${contractAddress}.${contractName}`);
    console.log('Network:', network);
    console.log('Token ID (hex):', tokenIdArg);

    // Call contract's get-svg function
    const response = await fetch(
      `${stacksApi}/v2/contracts/call-read/${contractAddress}/${contractName}/get-svg`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: 'SP000000000000000000002Q6VF78',
          arguments: [tokenIdArg]
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Contract call failed:', response.status, errorText);
      
      // Return diagnostic info
      return res.status(200).json({
        error: 'Contract call failed',
        status: response.status,
        message: errorText,
        contractAddress,
        contractName,
        suggestion: 'Contract may not have get-svg function or was deployed incorrectly'
      });
    }

    const data = await response.json();
    console.log('Raw contract response:', JSON.stringify(data, null, 2));

    // If we get here, return diagnostic info
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
      debug: 'Contract response received',
      contractAddress,
      contractName,
      tokenId,
      rawResponse: data,
      resultPreview: data.result?.substring(0, 500),
      suggestion: 'Check if result contains valid SVG string'
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch SVG from contract',
      details: error.message,
      stack: error.stack
    });
  }
}

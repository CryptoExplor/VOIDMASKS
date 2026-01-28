// API endpoint: /api/svg/[id].js
// Fetches on-chain SVG from the contract and serves it as image/svg+xml
// Uses proper Clarity value encoding

import { uintCV, cvToHex } from '@stacks/transactions';

export default async function handler(req, res) {
  const { id } = req.query;

  // Validate token ID
  const tokenId = parseInt(id);
  if (isNaN(tokenId) || tokenId < 1) {
    return res.status(400).json({ error: 'Invalid token ID' });
  }

  try {
    // Determine network and contract from environment or defaults
    const network = process.env.NETWORK || 'testnet';
    const contractAddress = process.env.CONTRACT_ADDRESS || 'ST1HCWN2BWA7HKY61AVPC0EKRB4TH84TMV26A4VRZ';
    const contractName = process.env.CONTRACT_NAME || 'test1'; // FIXED: Use correct contract name
    const stacksApi = network === 'mainnet' 
      ? 'https://api.mainnet.hiro.so'
      : 'https://api.testnet.hiro.so';

    // Encode the token ID as a Clarity uint using cvToHex
    const tokenIdArg = cvToHex(uintCV(tokenId));

    console.log('Fetching SVG for token:', tokenId);
    console.log('Contract:', `${contractAddress}.${contractName}`);
    console.log('Token ID argument (hex):', tokenIdArg);

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
      throw new Error(`Contract call failed: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Contract response:', JSON.stringify(data).substring(0, 200));

    // Extract SVG string from response
    let svgContent = '';
    
    if (data.result) {
      // Try to extract from hex format first (0x...)
      if (data.result.startsWith('0x')) {
        try {
          // Decode hex string
          const hex = data.result.slice(2); // Remove 0x prefix
          const bytes = hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16));
          svgContent = String.fromCharCode(...bytes);
          
          // Remove Clarity string wrapper if present
          if (svgContent.startsWith('"') && svgContent.endsWith('"')) {
            svgContent = svgContent.slice(1, -1);
          }
        } catch (hexError) {
          console.error('Error parsing hex:', hexError);
        }
      }
      
      // Try text format if hex didn't work
      if (!svgContent || !svgContent.includes('<svg')) {
        const match = data.result.match(/"([^"]*)"/);
        if (match && match[1]) {
          svgContent = match[1];
          
          // Decode URL-encoded characters that Clarity uses
          svgContent = svgContent.replace(/%23/g, '#')
                                 .replace(/%27/g, "'")
                                 .replace(/%3C/g, '<')
                                 .replace(/%3E/g, '>')
                                 .replace(/%20/g, ' ')
                                 .replace(/\+/g, ' ');
        }
      }
    }

    // Ensure we have valid SVG
    if (!svgContent || !svgContent.includes('<svg')) {
      console.error('Invalid SVG content. Raw result:', data.result?.substring(0, 200));
      console.error('Extracted SVG:', svgContent);
      throw new Error('Invalid SVG response from contract');
    }

    // Set appropriate headers
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Return SVG
    res.status(200).send(svgContent);

  } catch (error) {
    console.error('Error fetching SVG:', error);
    res.status(500).json({ 
      error: 'Failed to fetch SVG from contract',
      details: error.message 
    });
  }
}

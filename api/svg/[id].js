// API endpoint: /api/svg/[id].js
// Properly decodes Clarity hex-encoded SVG strings

import { uintCV, cvToHex } from '@stacks/transactions';

export default async function handler(req, res) {
  const { id } = req.query;

  // Validate token ID
  const tokenId = parseInt(id);
  if (isNaN(tokenId) || tokenId < 1) {
    return res.status(400).json({ error: 'Invalid token ID' });
  }

  try {
    // Get configuration
    const network = process.env.NETWORK || 'testnet';
    const contractAddress = process.env.CONTRACT_ADDRESS || 'ST1HCWN2BWA7HKY61AVPC0EKRB4TH84TMV26A4VRZ';
    const contractName = process.env.CONTRACT_NAME || 'test2';
    const stacksApi = network === 'mainnet' 
      ? 'https://api.mainnet.hiro.so'
      : 'https://api.testnet.hiro.so';

    // Encode token ID
    const tokenIdArg = cvToHex(uintCV(tokenId));

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

    // Check if call was successful
    if (!data.okay || !data.result) {
      throw new Error('Contract returned unsuccessful response');
    }

    // Decode the hex string
    const hexString = data.result;
    
    if (!hexString.startsWith('0x')) {
      throw new Error('Invalid hex format from contract');
    }

    // Remove 0x prefix
    const hex = hexString.slice(2);
    
    // Clarity strings are prefixed with type info (0x0d for string-ascii)
    // Skip the first few bytes which are Clarity type metadata
    // The actual string data starts after the length prefix
    
    let svgContent = '';
    let startIndex = 0;
    
    // Find where the actual SVG content starts (look for '<')
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
      if (byte > 0) { // Skip null bytes
        svgContent += String.fromCharCode(byte);
      }
    }

    // Validate we got valid SVG
    if (!svgContent || !svgContent.includes('<svg')) {
      throw new Error('Decoded content is not valid SVG');
    }

    // URL-decode any encoded characters (like %23 for #)
    svgContent = svgContent
      .replace(/%23/g, '#')
      .replace(/%27/g, "'")
      .replace(/%22/g, '"')
      .replace(/%3C/g, '<')
      .replace(/%3E/g, '>')
      .replace(/%20/g, ' ')
      .replace(/%2F/g, '/')
      .replace(/%3D/g, '=');

    // Return SVG
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(svgContent);

  } catch (error) {
    console.error('Error fetching SVG:', error);
    res.status(500).json({ 
      error: 'Failed to fetch SVG from contract',
      details: error.message 
    });
  }
}

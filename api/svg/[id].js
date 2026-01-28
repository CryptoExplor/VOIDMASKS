// API endpoint: /api/svg/[id].js
// Fetches on-chain SVG from the contract and serves it as image/svg+xml

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
    const contractName = process.env.CONTRACT_NAME || 'voidmasks';
    const stacksApi = network === 'mainnet' 
      ? 'https://api.mainnet.hiro.so'
      : 'https://api.testnet.hiro.so';

    // Call contract's get-svg function
    const response = await fetch(
      `${stacksApi}/v2/contracts/call-read/${contractAddress}/${contractName}/get-svg`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: 'SP000000000000000000002Q6VF78',
          arguments: [`0x${tokenId.toString(16).padStart(32, '0')}`]
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Contract call failed: ${response.statusText}`);
    }

    const data = await response.json();

    // Extract SVG string from response
    // The response format is typically: (ok "svg_string_here")
    let svgContent = '';
    
    if (data.result) {
      // Try to extract from text format: (ok "...")
      const textMatch = data.result.match(/"(.*)"/s);
      if (textMatch) {
        svgContent = decodeURIComponent(textMatch[1]);
      } else {
        // If that fails, use the whole result
        svgContent = data.result;
      }
    }

    // Ensure we have valid SVG
    if (!svgContent || !svgContent.includes('<svg')) {
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

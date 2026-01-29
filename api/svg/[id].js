// API endpoint: /api/svg/[id].js - WITH FALLBACK
// Tries contract first, falls back to client-side generation

import { uintCV, cvToHex } from '@stacks/transactions';

// SVG Generation fallback (same as frontend)
function hashTokenId(tokenId, salt = 0) {
  const combined = (tokenId * 2654435761 + salt) % 4294967296;
  return Math.abs(combined);
}

function generateColor(tokenId, component = 0) {
  const seed = hashTokenId(tokenId, component);
  const r = (seed >> 16) & 0xFF;
  const g = (seed >> 8) & 0xFF;
  const b = seed & 0xFF;
  return `rgb(${r},${g},${b})`;
}

function generateSVGFallback(tokenId) {
  const canvasSize = 400;
  const centerX = canvasSize / 2;
  const centerY = canvasSize / 2;
  const baseSize = 120;
  
  const backgroundColor = generateColor(tokenId, 0);
  const shapeColor = generateColor(tokenId, 1);
  const pattern = hashTokenId(tokenId, 2) % 5;
  const sizeMod = 0.8 + (hashTokenId(tokenId, 3) % 20) / 100;
  const size = baseSize * sizeMod;
  
  let mainShape = '';
  if (pattern === 0) {
    mainShape = `<circle cx="${centerX}" cy="${centerY}" r="${size}" fill="${shapeColor}" opacity="0.8"/>`;
  } else if (pattern === 1) {
    const h = size * Math.sqrt(3) / 2;
    mainShape = `<polygon points="${centerX},${centerY - h/2} ${centerX - size/2},${centerY + h/2} ${centerX + size/2},${centerY + h/2}" fill="${shapeColor}" opacity="0.8"/>`;
  } else if (pattern === 2) {
    mainShape = `<rect x="${centerX - size/2}" y="${centerY - size/2}" width="${size}" height="${size}" fill="${shapeColor}" opacity="0.8"/>`;
  } else if (pattern === 3) {
    mainShape = `<polygon points="${centerX},${centerY - size} ${centerX + size},${centerY} ${centerX},${centerY + size} ${centerX - size},${centerY}" fill="${shapeColor}" opacity="0.8"/>`;
  } else {
    const thick = size / 3;
    mainShape = `<rect x="${centerX - thick/2}" y="${centerY - size}" width="${thick}" height="${size * 2}" fill="${shapeColor}" opacity="0.8"/><rect x="${centerX - size}" y="${centerY - thick/2}" width="${size * 2}" height="${thick}" fill="${shapeColor}" opacity="0.8"/>`;
  }
  
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasSize} ${canvasSize}" width="${canvasSize}" height="${canvasSize}">
    <rect width="${canvasSize}" height="${canvasSize}" fill="${backgroundColor}"/>
    ${mainShape}
    <defs>
      <radialGradient id="mask-${tokenId}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="white" stop-opacity="0"/>
        <stop offset="70%" stop-color="white" stop-opacity="0.1"/>
        <stop offset="100%" stop-color="black" stop-opacity="0.3"/>
      </radialGradient>
    </defs>
    <rect x="0" y="0" width="${canvasSize}" height="${canvasSize}" fill="url(#mask-${tokenId})"/>
  </svg>`;
}

export default async function handler(req, res) {
  const { id } = req.query;
  const tokenId = parseInt(id);
  
  if (isNaN(tokenId) || tokenId < 1) {
    return res.status(400).json({ error: 'Invalid token ID' });
  }

  // Try to get from contract first
  try {
    const network = process.env.NETWORK || 'testnet';
    const contractAddress = process.env.CONTRACT_ADDRESS || 'ST1HCWN2BWA7HKY61AVPC0EKRB4TH84TMV26A4VRZ';
    const contractName = process.env.CONTRACT_NAME || 'test1';
    const stacksApi = network === 'mainnet' 
      ? 'https://api.mainnet.hiro.so'
      : 'https://api.testnet.hiro.so';

    const tokenIdArg = cvToHex(uintCV(tokenId));

    console.log('Attempting to fetch SVG from contract...');
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

    if (response.ok) {
      const data = await response.json();
      
      if (data.result) {
        let svgContent = '';
        
        // Try hex format
        if (data.result.startsWith('0x')) {
          try {
            const hex = data.result.slice(2);
            const bytes = hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16));
            svgContent = String.fromCharCode(...bytes.filter(b => b > 0));
            
            if (svgContent.startsWith('"')) svgContent = svgContent.slice(1);
            if (svgContent.endsWith('"')) svgContent = svgContent.slice(0, -1);
          } catch (e) {
            console.error('Hex parse error:', e);
          }
        }
        
        // Try text format
        if (!svgContent || !svgContent.includes('<svg')) {
          const match = data.result.match(/"([^"]*)"/);
          if (match && match[1]) {
            svgContent = match[1]
              .replace(/%23/g, '#')
              .replace(/%27/g, "'")
              .replace(/%3C/g, '<')
              .replace(/%3E/g, '>')
              .replace(/\+/g, ' ');
          }
        }
        
        // If we got valid SVG, return it
        if (svgContent && svgContent.includes('<svg')) {
          console.log('Successfully fetched SVG from contract');
          res.setHeader('Content-Type', 'image/svg+xml');
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          res.setHeader('Access-Control-Allow-Origin', '*');
          return res.status(200).send(svgContent);
        }
      }
    }
    
    // If we get here, contract call failed or returned invalid data
    console.log('Contract call failed or returned invalid data, using fallback...');
    
  } catch (error) {
    console.error('Contract error:', error.message);
  }

  // FALLBACK: Generate SVG client-side
  console.log('Using client-side SVG generation for token', tokenId);
  const svg = generateSVGFallback(tokenId);
  
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-SVG-Source', 'fallback'); // Indicates this was generated, not from contract
  res.status(200).send(svg);
}

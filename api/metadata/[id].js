// API endpoint: /api/metadata/[id].js
// Returns SIP-009 compliant JSON metadata for each token

export default async function handler(req, res) {
  const { id } = req.query;

  // Validate token ID
  const tokenId = parseInt(id);
  if (isNaN(tokenId) || tokenId < 1) {
    return res.status(400).json({ error: 'Invalid token ID' });
  }

  // Set CORS headers for cross-origin access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  // Return SIP-009 compliant metadata
  res.status(200).json({
    name: `VOIDMASK #${tokenId}`,
    description: "VOIDMASKS is a Phase-8 schizocore PFP collection. Each mask is generated fully on-chain using deterministic Clarity logic and rendered as SVG.",
    image: `https://voidmasks.vercel.app/api/svg/${tokenId}`,
    attributes: [
      {
        trait_type: "Edition",
        value: tokenId
      },
      {
        trait_type: "Generation",
        value: "Phase-8"
      },
      {
        trait_type: "Storage",
        value: "On-Chain"
      }
    ]
  });
}

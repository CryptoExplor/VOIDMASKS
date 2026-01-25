// Deterministic SVG Generation Engine
// Generates unique artwork from token IDs using mathematical algorithms

// Hash function to create deterministic values from token ID
function hashTokenId(tokenId, salt = 0) {
    // Simple hash combining token ID with salt
    const combined = (tokenId * 2654435761 + salt) % 4294967296;
    return Math.abs(combined);
}

// Generate deterministic color from token ID and component
function generateColor(tokenId, component = 0) {
    const seed = hashTokenId(tokenId, component);
    const r = (seed >> 16) & 0xFF;
    const g = (seed >> 8) & 0xFF;
    const b = seed & 0xFF;
    return `rgb(${r},${g},${b})`;
}

// Generate background color
function generateBackgroundColor(tokenId) {
    return generateColor(tokenId, 0);
}

// Generate shape color
function generateShapeColor(tokenId) {
    return generateColor(tokenId, 1);
}

// Generate pattern type (0-4)
function generatePatternType(tokenId) {
    return hashTokenId(tokenId, 2) % 5;
}

// Generate shape size modifier
function generateSizeModifier(tokenId) {
    return 0.8 + (hashTokenId(tokenId, 3) % 20) / 100;
}

// Generate rotation angle
function generateRotation(tokenId) {
    return (hashTokenId(tokenId, 4) % 360) - 180;
}

// Generate shape complexity
function generateComplexity(tokenId) {
    return (hashTokenId(tokenId, 5) % 3) + 2;
}

// Generate geometric shapes
function generateCircle(cx, cy, r, fill, opacity = 0.8) {
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" opacity="${opacity}"/>`;
}

function generateRectangle(x, y, width, height, fill, opacity = 0.8) {
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" opacity="${opacity}"/>`;
}

function generatePolygon(points, fill, opacity = 0.8) {
    return `<polygon points="${points}" fill="${fill}" opacity="${opacity}"/>`;
}

function generatePath(d, fill, opacity = 0.8) {
    return `<path d="${d}" fill="${fill}" opacity="${opacity}"/>`;
}

// Generate main shape based on pattern type
function generateMainShape(tokenId, centerX, centerY, baseSize) {
    const pattern = generatePatternType(tokenId);
    const shapeColor = generateShapeColor(tokenId);
    const sizeMod = generateSizeModifier(tokenId);
    const rotation = generateRotation(tokenId);
    const size = baseSize * sizeMod;
    
    const shapes = [
        // Circle
        () => generateCircle(centerX, centerY, size, shapeColor),
        
        // Triangle
        () => {
            const h = size * Math.sqrt(3) / 2;
            const points = `${centerX},${centerY - h/2} ${centerX - size/2},${centerY + h/2} ${centerX + size/2},${centerY + h/2}`;
            return generatePolygon(points, shapeColor);
        },
        
        // Square
        () => generateRectangle(centerX - size/2, centerY - size/2, size, size, shapeColor),
        
        // Diamond
        () => {
            const points = `${centerX},${centerY - size} ${centerX + size},${centerY} ${centerX},${centerY + size} ${centerX - size},${centerY}`;
            return generatePolygon(points, shapeColor);
        },
        
        // Cross
        () => {
            const thick = size / 3;
            return `
                ${generateRectangle(centerX - thick/2, centerY - size, thick, size * 2, shapeColor)}
                ${generateRectangle(centerX - size, centerY - thick/2, size * 2, thick, shapeColor)}
            `;
        }
    ];
    
    return shapes[pattern]();
}

// Generate decorative elements
function generateDecorations(tokenId, canvasSize) {
    const complexity = generateComplexity(tokenId);
    const decorations = [];
    const bgColor = generateBackgroundColor(tokenId);
    
    for (let i = 0; i < complexity; i++) {
        const seed = hashTokenId(tokenId, 10 + i);
        const x = (seed % canvasSize) * 0.8 + canvasSize * 0.1;
        const y = (hashTokenId(tokenId, 15 + i) % canvasSize) * 0.8 + canvasSize * 0.1;
        const size = (hashTokenId(tokenId, 20 + i) % (canvasSize / 10)) + 5;
        const opacity = 0.3 + (hashTokenId(tokenId, 25 + i) % 50) / 100;
        
        // Alternate between small circles and squares
        if (i % 2 === 0) {
            decorations.push(generateCircle(x, y, size, bgColor, opacity));
        } else {
            decorations.push(generateRectangle(x - size/2, y - size/2, size, size, bgColor, opacity));
        }
    }
    
    return decorations.join('\n');
}

// Generate mask effect overlay
function generateMaskOverlay(canvasSize) {
    const gradientId = `mask-gradient-${Math.random().toString(36).substr(2, 9)}`;
    return `
        <defs>
            <radialGradient id="${gradientId}" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="white" stop-opacity="0"/>
                <stop offset="70%" stop-color="white" stop-opacity="0.1"/>
                <stop offset="100%" stop-color="black" stop-opacity="0.3"/>
            </radialGradient>
        </defs>
        <rect x="0" y="0" width="${canvasSize}" height="${canvasSize}" fill="url(#${gradientId})"/>
    `;
}

// Main SVG generation function
export function generateSVGFromTokenId(tokenId) {
    const canvasSize = 400;
    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;
    const baseShapeSize = 120;
    
    const backgroundColor = generateBackgroundColor(tokenId);
    const mainShape = generateMainShape(tokenId, centerX, centerY, baseShapeSize);
    const decorations = generateDecorations(tokenId, canvasSize);
    const maskOverlay = generateMaskOverlay(canvasSize);
    
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasSize} ${canvasSize}" width="${canvasSize}" height="${canvasSize}">
            <!-- Background -->
            <rect width="${canvasSize}" height="${canvasSize}" fill="${backgroundColor}"/>
            
            <!-- Decorative elements -->
            ${decorations}
            
            <!-- Main shape -->
            ${mainShape}
            
            <!-- Mask overlay effect -->
            ${maskOverlay}
        </svg>
    `;
    
    return svg.trim();
}

// Generate base64 encoded SVG data URI
export function generateBase64SVG(tokenId) {
    const svg = generateSVGFromTokenId(tokenId);
    const base64 = btoa(svg);
    return `data:image/svg+xml;base64,${base64}`;
}

// Generate SVG as data URI (non-base64)
export function generateDataUriSVG(tokenId) {
    const svg = generateSVGFromTokenId(tokenId);
    // Properly escape SVG for data URI
    const escapedSVG = encodeURIComponent(svg);
    return `data:image/svg+xml,${escapedSVG}`;
}

// Pre-generate multiple tokens for gallery display
export function generatePreviewTokens(startId = 1, count = 12) {
    const tokens = [];
    for (let i = startId; i < startId + count; i++) {
        tokens.push({
            id: i,
            svg: generateSVGFromTokenId(i)
        });
    }
    return tokens;
}
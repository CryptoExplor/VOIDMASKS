// ========================================
// UI CONTROLLER
// State management & DOM interactions
// ========================================

import { CONFIG, utils, toggleNetwork } from './config.js';
import { getWalletState, executeMint, disconnectWallet, initializeWallet } from './wallet.js';
import { getTotalSupply, getTokensByOwner, getLastTokenId, getOwnerOfToken, callRead } from './contract.js';
import { generateSVGFromTokenId, generatePreviewTokens } from './svg.js';
import { hexToCV, cvToValue, uintCV, cvToHex } from '@stacks/transactions';

// Global UI state
let uiState = {
    totalSupply: 0,
    lastTokenId: 0,
    userTokens: [],
    isLoading: false
};

// Initialize app
export async function initializeApp() {
    console.log('Initializing VOIDMASKS UI...');

    // Restore wallet session and start monitoring
    initializeWallet();

    // Display network badge
    updateNetworkBadge();

    // Set up event listeners
    setupEventListeners();

    // Load initial data
    await refreshData();

    // Set up periodic refresh
    setInterval(refreshData, CONFIG.REFRESH_INTERVAL);

    console.log('VOIDMASKS UI initialized');
}

// Set up all event listeners
function setupEventListeners() {
    // Mint button
    const mintBtn = document.getElementById('mint-btn');
    if (mintBtn) {
        mintBtn.addEventListener('click', handleMint);
    }

    // Token explorer
    const viewTokenBtn = document.getElementById('view-token-btn');
    if (viewTokenBtn) {
        viewTokenBtn.addEventListener('click', handleViewToken);
    }

    // Network switch
    const networkBadge = document.getElementById('network-badge');
    if (networkBadge) {
        networkBadge.addEventListener('click', handleNetworkSwitch);
    }
}

// Handle network switch
async function handleNetworkSwitch() {
    const wallet = getWalletState();

    // If wallet is connected, disconnect first
    if (wallet.isConnected) {
        const confirmed = confirm('Switching networks will disconnect your wallet. Continue?');
        if (!confirmed) return;

        disconnectWallet();
    }

    // Toggle network
    const newNetwork = toggleNetwork();
    console.log(`Switched to ${newNetwork}`);

    // Update UI
    updateNetworkBadge();
    await refreshData();
}

// Update UI based on wallet state
export function updateUIState(action, walletState = null) {
    const connectBtn = document.getElementById('connect-wallet');
    const walletInfo = document.getElementById('wallet-info');
    const walletAddress = document.getElementById('wallet-address');
    const mintBtn = document.getElementById('mint-btn');

    if (action === 'connected' && walletState) {
        // Hide connect button, show wallet info
        if (connectBtn) connectBtn.classList.add('hidden');
        if (walletInfo) walletInfo.classList.remove('hidden');

        // Display wallet address
        if (walletAddress) {
            walletAddress.textContent = utils.truncateAddress(walletState.address);
        }

        // Enable mint button
        if (mintBtn) mintBtn.disabled = false;

        // Load user's tokens
        loadUserTokens(walletState.address);

    } else if (action === 'disconnected') {
        // Show connect button, hide wallet info
        if (connectBtn) connectBtn.classList.remove('hidden');
        if (walletInfo) walletInfo.classList.add('hidden');

        // Disable mint button
        if (mintBtn) mintBtn.disabled = true;

        // Clear user tokens
        uiState.userTokens = [];
        renderCollection();
    }
}

// Refresh all data
async function refreshData() {
    try {
        // Get total supply
        const supply = await getTotalSupply();
        uiState.totalSupply = supply;

        // Get last token ID
        const lastId = await getLastTokenId();
        uiState.lastTokenId = lastId;

        // Update UI
        updateSupplyDisplay();

        // If wallet connected, refresh user tokens
        const wallet = getWalletState();
        if (wallet.isConnected) {
            await loadUserTokens(wallet.address);
        }
    } catch (error) {
        console.error('Failed to refresh data:', error);
    }
}

// Update supply display
function updateSupplyDisplay() {
    // Update any supply indicators in UI
    const supplyElements = document.querySelectorAll('.supply-count');
    supplyElements.forEach(el => {
        el.textContent = `${uiState.totalSupply} / 10000`;
    });
}

// Load user's tokens
async function loadUserTokens(address) {
    try {
        showLoading(true);
        const tokens = await getTokensByOwner(address);
        uiState.userTokens = tokens;
        renderCollection();
        showLoading(false);
    } catch (error) {
        console.error('Failed to load user tokens:', error);
        showLoading(false);
    }
}

/**
 * Attempt to get the on-chain SVG directly from the get-svg function.
 * This bypasses get-token-uri which is now SIP-009 compliant (limited to 256 chars).
 */
async function getOnChainSVG(tokenId) {
    try {
        // Use proper CV helpers for the argument
        const tokenHex = cvToHex(uintCV(tokenId));

        const res = await callRead('get-svg', [tokenHex]);

        if (res && res.result) {
            if (res.result.startsWith('0x')) {
                const clarityValue = hexToCV(res.result);
                const value = cvToValue(clarityValue);
                // The value might be a string or a more complex object depending on the API
                return (typeof value === 'object' && value !== null && 'value' in value) ? value.value : value;
            }
            // Fallback for plain string responses
            return res.result.replace(/^"(.*)"$/, '$1');
        }
    } catch (e) {
        console.warn(`Could not fetch on-chain SVG for ${tokenId}, using local generator.`, e);
    }
    return null;
}

// Render user's collection
function renderCollection() {
    const container = document.getElementById('collection-container');
    if (!container) return;

    if (uiState.userTokens.length === 0) {
        container.innerHTML = '<p class="empty-state">No tokens yet. Mint your first VOIDMASK!</p>';
        return;
    }

    container.innerHTML = '';

    uiState.userTokens.forEach(async tokenId => {
        // Create skeleton/placeholder with local preview
        const tokenEl = document.createElement('div');
        tokenEl.className = 'token-card';
        tokenEl.innerHTML = `
            <div class="token-svg">${generateSVGFromTokenId(tokenId)}</div>
            <div class="token-id">${utils.formatTokenId(tokenId)}</div>
        `;
        container.appendChild(tokenEl);

        // Try to replace with actual on-chain SVG
        const onChainSvg = await getOnChainSVG(tokenId);
        if (onChainSvg) {
            const svgContainer = tokenEl.querySelector('.token-svg');
            if (svgContainer) svgContainer.innerHTML = onChainSvg;
        }

        // Click to view in explorer
        tokenEl.addEventListener('click', () => {
            viewToken(tokenId);
        });
    });
}

// Handle mint button click
async function handleMint() {
    const mintBtn = document.getElementById('mint-btn');
    const wallet = getWalletState();

    if (!wallet.isConnected) {
        alert('Please connect your wallet first');
        return;
    }

    try {
        // Disable button and show loading
        if (mintBtn) {
            mintBtn.disabled = true;
            mintBtn.textContent = 'Minting...';
        }

        // Execute mint
        const result = await executeMint();

        if (result.success) {
            alert(`Mint successful! Transaction ID: ${result.txId.substring(0, 10)}...`);

            // Refresh data after short delay
            setTimeout(() => {
                refreshData();
            }, 5000);
        }

    } catch (error) {
        console.error('Mint failed:', error);
        alert(`Mint failed: ${error.message}`);
    } finally {
        // Re-enable button
        if (mintBtn) {
            mintBtn.disabled = false;
            mintBtn.textContent = 'Mint NFT';
        }
    }
}

// Handle view token button click
function handleViewToken() {
    const input = document.getElementById('token-id-input');
    if (!input) return;

    const tokenId = parseInt(input.value);

    if (isNaN(tokenId) || tokenId < 1) {
        alert('Please enter a valid token ID');
        return;
    }

    viewToken(tokenId);
}

// View specific token
async function viewToken(tokenId) {
    const display = document.getElementById('token-display');
    if (!display) return;

    // Show initial local version immediately
    const localSvg = generateSVGFromTokenId(tokenId);
    display.innerHTML = `
        <div class="token-viewer">
            <h3>${utils.formatTokenId(tokenId)}</h3>
            <div class="token-svg-large">${localSvg}</div>
            <div class="token-metadata-status">Loading on-chain metadata...</div>
        </div>
    `;
    display.classList.remove('hidden');

    // Try to fetch on-chain version
    const onChainSvg = await getOnChainSVG(tokenId);
    if (onChainSvg) {
        const largeContainer = display.querySelector('.token-svg-large');
        const metaStatus = display.querySelector('.token-metadata-status');
        if (largeContainer) largeContainer.innerHTML = onChainSvg;
        if (metaStatus) metaStatus.textContent = 'Verified On-Chain Artwork';
    } else {
        const metaStatus = display.querySelector('.token-metadata-status');
        if (metaStatus) metaStatus.textContent = 'Using Preview (Pending Indexer)';
    }
}

// Show/hide loading state
function showLoading(isLoading) {
    uiState.isLoading = isLoading;

    // Update loading indicators
    const loadingElements = document.querySelectorAll('.loading-indicator');
    loadingElements.forEach(el => {
        if (isLoading) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });
}

// Export state for debugging
export function getUIState() {
    return { ...uiState };
}

// Update network badge
function updateNetworkBadge() {
    const badge = document.getElementById('network-badge');
    if (!badge) return;

    const network = CONFIG.NETWORK;
    badge.innerHTML = network === 'mainnet' ? '🟢 Mainnet ⇄' : '🟠 Testnet ⇄';
    badge.className = `network-badge ${network}`;
    badge.title = `Currently on ${network}. Click to switch.`;

    // Handle Faucet Link Visibility in Header
    const faucetLink = document.getElementById('faucet-link');
    if (faucetLink) {
        if (network === 'testnet') {
            faucetLink.classList.remove('hidden');
        } else {
            faucetLink.classList.add('hidden');
        }
    }

    // Update Mint Price Display
    const priceDisplay = document.getElementById('mint-price');
    if (priceDisplay) {
        priceDisplay.textContent = CONFIG.MIN_FEE_DISPLAY;
    }
}

// ========================================
// UI CONTROLLER
// State management & DOM interactions
// ========================================

import { CONFIG, utils, toggleNetwork } from './config.js';
import { getWalletState, executeMint, disconnectWallet } from './wallet.js';
import { getTotalSupply, getTokensByOwner, getLastTokenId, hasAlreadyMinted } from './contract.js';
import { generateSVGFromTokenId, generatePreviewTokens } from './svg.js';

// Global UI state
let uiState = {
    totalSupply: 0,
    lastTokenId: 0,
    userTokens: [],
    isLoading: false,
    currentAddress: null,
    hasMinted: false
};

// Initialize app
export async function initializeApp() {
    console.log('Initializing VOIDMASKS UI...');

    // Display network badge
    updateNetworkBadge();

    // Set up event listeners
    setupEventListeners();

    // Check if wallet is connected and update UI
    const wallet = getWalletState();
    if (wallet.isConnected) {
        updateUIState('connected', wallet);
    }

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
export async function updateUIState(action, walletState = null) {
    const connectBtn = document.getElementById('connect-wallet');
    const walletInfo = document.getElementById('wallet-info');
    const walletAddress = document.getElementById('wallet-address');
    const mintBtn = document.getElementById('mint-btn');

    if (action === 'connected' && walletState) {
        // Check if address actually changed
        const addressChanged = uiState.currentAddress !== walletState.address;
        
        if (addressChanged) {
            console.log('Address changed from', uiState.currentAddress, 'to', walletState.address);
            uiState.currentAddress = walletState.address;
            
            // Clear old tokens when address changes
            uiState.userTokens = [];
            uiState.hasMinted = false;
        }
        
        // Hide connect button, show wallet info
        if (connectBtn) connectBtn.classList.add('hidden');
        if (walletInfo) walletInfo.classList.remove('hidden');

        // Display wallet address
        if (walletAddress) {
            walletAddress.textContent = utils.truncateAddress(walletState.address);
        }

        // Check if user has already minted
        try {
            const alreadyMinted = await hasAlreadyMinted(walletState.address);
            uiState.hasMinted = alreadyMinted;
            console.log('Has already minted:', alreadyMinted);
            
            // Update mint button state
            if (mintBtn) {
                if (alreadyMinted) {
                    mintBtn.disabled = true;
                    mintBtn.textContent = 'Already Minted';
                    mintBtn.title = 'You have already minted your NFT (one per address)';
                } else {
                    mintBtn.disabled = false;
                    mintBtn.textContent = 'Mint NFT';
                    mintBtn.title = 'Mint your VOIDMASK NFT';
                }
            }
        } catch (error) {
            console.error('Error checking mint status:', error);
            // Enable button on error to allow retry
            if (mintBtn) {
                mintBtn.disabled = false;
            }
        }

        // Load user's tokens (will reload if address changed)
        loadUserTokens(walletState.address);

    } else if (action === 'disconnected') {
        // Show connect button, hide wallet info
        if (connectBtn) connectBtn.classList.remove('hidden');
        if (walletInfo) walletInfo.classList.add('hidden');

        // Disable mint button
        if (mintBtn) {
            mintBtn.disabled = true;
            mintBtn.textContent = 'Mint NFT';
            mintBtn.title = 'Connect wallet to mint';
        }

        // Clear user tokens and address
        uiState.userTokens = [];
        uiState.currentAddress = null;
        uiState.hasMinted = false;
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
            // Check if address changed (wallet switched account)
            if (uiState.currentAddress !== wallet.address) {
                console.log('Wallet address changed detected during refresh');
                await updateUIState('connected', wallet);
            } else {
                await loadUserTokens(wallet.address);
            }
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
    // Don't reload if already loading for same address
    if (uiState.isLoading) {
        console.log('Already loading tokens, skipping...');
        return;
    }
    
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

// Render user's collection
function renderCollection() {
    const container = document.getElementById('collection-container');
    if (!container) return;

    if (uiState.userTokens.length === 0) {
        container.innerHTML = '<p class="empty-state">No tokens yet. Mint your first VOIDMASK!</p>';
        return;
    }

    container.innerHTML = '';

    uiState.userTokens.forEach(tokenId => {
        // Fallback SVG data URI if API fails
        const fallbackSvg = generateSVGFromTokenId(tokenId);
        const fallbackDataUri = `data:image/svg+xml;base64,${btoa(fallbackSvg)}`;

        const tokenEl = document.createElement('div');
        tokenEl.className = 'token-card';
        tokenEl.innerHTML = `
            <div class="token-svg">
                <img src="/api/svg/${tokenId}" 
                     alt="VOIDMASK ${tokenId}" 
                     loading="lazy"
                     onerror="this.onerror=null; this.src='${fallbackDataUri}'; this.classList.add('fallback');" />
            </div>
            <div class="token-id">${utils.formatTokenId(tokenId)}</div>
        `;

        // Click to view in explorer
        tokenEl.addEventListener('click', () => {
            viewToken(tokenId);
        });

        container.appendChild(tokenEl);
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

    // Double-check if already minted
    if (uiState.hasMinted) {
        alert('You have already minted your VOIDMASK NFT (one per address)');
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

            // Mark as minted immediately
            uiState.hasMinted = true;
            
            // Update mint button to permanently disabled state
            if (mintBtn) {
                mintBtn.disabled = true;
                mintBtn.textContent = 'Already Minted';
                mintBtn.title = 'You have already minted your NFT (one per address)';
            }

            // Refresh data after short delay
            setTimeout(() => {
                refreshData();
            }, 5000);
        }

    } catch (error) {
        console.error('Mint failed:', error);
        alert(`Mint failed: ${error.message}`);
        
        // Re-enable button only if user hasn't minted yet
        if (mintBtn && !uiState.hasMinted) {
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
function viewToken(tokenId) {
    const display = document.getElementById('token-display');
    if (!display) return;

    // Fallback SVG data URI if API fails
    const fallbackSvg = generateSVGFromTokenId(tokenId);
    const fallbackDataUri = `data:image/svg+xml;base64,${btoa(fallbackSvg)}`;

    display.innerHTML = `
        <div class="token-viewer">
            <h3>${utils.formatTokenId(tokenId)}</h3>
            <div class="token-svg-large">
                <img src="/api/svg/${tokenId}" 
                     alt="VOIDMASK ${tokenId}" 
                     onerror="this.onerror=null; this.src='${fallbackDataUri}'; this.classList.add('fallback');" />
            </div>
        </div>
    `;

    display.classList.remove('hidden');
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

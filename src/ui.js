// ========================================
// UI CONTROLLER
// State management & DOM interactions
// ========================================

import { CONFIG, utils } from './config.js';
import { getWalletState, executeMint } from './wallet.js';
import { getTotalSupply, getTokensByOwner, getLastTokenId } from './contract.js';
import { generateSVGFromTokenId, generatePreviewTokens } from './svg.js';

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
    
    // Token input - view on Enter
    const tokenInput = document.getElementById('token-id-input');
    if (tokenInput) {
        tokenInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleViewToken();
            }
        });
    }
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
        const svg = generateSVGFromTokenId(tokenId);
        
        const tokenEl = document.createElement('div');
        tokenEl.className = 'token-card';
        tokenEl.innerHTML = `
            <div class="token-svg">${svg}</div>
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
function viewToken(tokenId) {
    const display = document.getElementById('token-display');
    if (!display) return;
    
    const svg = generateSVGFromTokenId(tokenId);
    
    display.innerHTML = `
        <div class="token-viewer">
            <h3>Token ${utils.formatTokenId(tokenId)}</h3>
            <div class="token-svg-large">${svg}</div>
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
// ========================================
// UI CONTROLLER
// State management & DOM interactions
// ========================================

import { CONFIG, utils, toggleNetwork } from './config.js';
import { getWalletState, executeMint, disconnectWallet } from './wallet.js';
import { getTotalSupply, getTokensByOwner, getLastTokenId, hasAlreadyMinted } from './contract.js';
import { generateSVGFromTokenId } from './svg.js';

let uiState = {
    totalSupply: 0,
    lastTokenId: 0,
    userTokens: [],
    isLoading: false,
    currentAddress: null,
    hasMinted: false
};

// NEW: Custom Toast Notification System
export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Remove toast after 4 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

export async function initializeApp() {
    updateNetworkBadge();
    setupEventListeners();

    const wallet = getWalletState();
    if (wallet.isConnected) updateUIState('connected', wallet);

    await refreshData();
    setInterval(refreshData, CONFIG.REFRESH_INTERVAL);
}

function setupEventListeners() {
    const mintBtn = document.getElementById('mint-btn');
    if (mintBtn) mintBtn.addEventListener('click', handleMint);

    const viewTokenBtn = document.getElementById('view-token-btn');
    if (viewTokenBtn) viewTokenBtn.addEventListener('click', handleViewToken);

    const networkBadge = document.getElementById('network-badge');
    if (networkBadge) networkBadge.addEventListener('click', handleNetworkSwitch);
}

async function handleNetworkSwitch() {
    const wallet = getWalletState();
    if (wallet.isConnected) {
        disconnectWallet();
        showToast('Wallet disconnected due to network switch', 'info');
    }

    const newNetwork = toggleNetwork();
    updateNetworkBadge();
    await refreshData();
    showToast(`Switched to ${newNetwork}`, 'success');
}

export async function updateUIState(action, walletState = null) {
    const connectBtn = document.getElementById('connect-wallet');
    const walletInfo = document.getElementById('wallet-info');
    const walletAddress = document.getElementById('wallet-address');
    const mintBtn = document.getElementById('mint-btn');

    if (action === 'connected' && walletState) {
        if (uiState.currentAddress !== walletState.address) {
            uiState.currentAddress = walletState.address;
            uiState.userTokens = [];
            uiState.hasMinted = false;
        }
        
        if (connectBtn) connectBtn.classList.add('hidden');
        if (walletInfo) walletInfo.classList.remove('hidden');
        if (walletAddress) walletAddress.textContent = utils.truncateAddress(walletState.address);

        try {
            const alreadyMinted = await hasAlreadyMinted(walletState.address);
            uiState.hasMinted = alreadyMinted;
            
            if (mintBtn) {
                if (alreadyMinted) {
                    mintBtn.disabled = true;
                    mintBtn.textContent = 'Already Minted';
                } else {
                    mintBtn.disabled = false;
                    mintBtn.textContent = 'Mint NFT';
                }
            }
        } catch (error) {
            if (mintBtn) mintBtn.disabled = false;
        }

        loadUserTokens(walletState.address);

    } else if (action === 'disconnected') {
        if (connectBtn) connectBtn.classList.remove('hidden');
        if (walletInfo) walletInfo.classList.add('hidden');

        if (mintBtn) {
            mintBtn.disabled = true;
            mintBtn.textContent = 'Mint NFT';
        }

        uiState.userTokens = [];
        uiState.currentAddress = null;
        uiState.hasMinted = false;
        renderCollection();
    }
}

async function refreshData() {
    try {
        uiState.totalSupply = await getTotalSupply();
        uiState.lastTokenId = await getLastTokenId();
        updateSupplyDisplay();

        const wallet = getWalletState();
        if (wallet.isConnected) {
            if (uiState.currentAddress !== wallet.address) {
                await updateUIState('connected', wallet);
            } else {
                await loadUserTokens(wallet.address);
            }
        }
    } catch (error) {
        console.error('Failed to refresh data:', error);
    }
}

// UPDATED: Fill progress bar based on supply
function updateSupplyDisplay() {
    const supplyElements = document.querySelectorAll('.supply-count');
    supplyElements.forEach(el => {
        el.textContent = `${uiState.totalSupply} / 10000`;
    });

    const progressBar = document.getElementById('supply-progress');
    if (progressBar) {
        // Calculate percentage (max 10,000)
        const percentage = Math.min((uiState.totalSupply / 10000) * 100, 100);
        progressBar.style.width = `${percentage}%`;
    }
}

async function loadUserTokens(address) {
    if (uiState.isLoading) return;
    try {
        uiState.isLoading = true;
        uiState.userTokens = await getTokensByOwner(address);
        renderCollection();
    } catch (error) {
        console.error('Failed to load user tokens:', error);
    } finally {
        uiState.isLoading = false;
    }
}

function renderCollection() {
    const container = document.getElementById('collection-container');
    if (!container) return;

    if (uiState.userTokens.length === 0) {
        container.innerHTML = '<p class="empty-state">No tokens yet. Mint your first VOIDMASK!</p>';
        return;
    }

    container.innerHTML = '';
    uiState.userTokens.forEach(tokenId => {
        const fallbackSvg = generateSVGFromTokenId(tokenId);
        const fallbackDataUri = `data:image/svg+xml;base64,${btoa(fallbackSvg)}`;

        const tokenEl = document.createElement('div');
        tokenEl.className = 'token-card';
        tokenEl.innerHTML = `
            <div class="token-svg">
                <img src="/api/svg/${tokenId}" alt="VOIDMASK ${tokenId}" loading="lazy" onerror="this.src='${fallbackDataUri}';" />
            </div>
            <div class="token-id">${utils.formatTokenId(tokenId)}</div>
        `;
        tokenEl.addEventListener('click', () => viewToken(tokenId));
        container.appendChild(tokenEl);
    });
}

// UPDATED: Replaced alert() with showToast()
async function handleMint() {
    const mintBtn = document.getElementById('mint-btn');
    const wallet = getWalletState();

    if (!wallet.isConnected) {
        showToast('Please connect your wallet first', 'error');
        return;
    }

    if (uiState.hasMinted) {
        showToast('You have already minted your VOIDMASK', 'error');
        return;
    }

    try {
        if (mintBtn) {
            mintBtn.disabled = true;
            mintBtn.textContent = 'Minting...';
        }

        const result = await executeMint();

        if (result.success) {
            showToast(`Mint successful! TX ID: ${result.txId.substring(0, 8)}...`, 'success');
            uiState.hasMinted = true;
            
            if (mintBtn) {
                mintBtn.disabled = true;
                mintBtn.textContent = 'Already Minted';
            }
            setTimeout(refreshData, 5000);
        }

    } catch (error) {
        showToast(`Mint failed: ${error.message}`, 'error');
        if (mintBtn && !uiState.hasMinted) {
            mintBtn.disabled = false;
            mintBtn.textContent = 'Mint NFT';
        }
    }
}

function handleViewToken() {
    const input = document.getElementById('token-id-input');
    if (!input) return;
    const tokenId = parseInt(input.value);
    if (isNaN(tokenId) || tokenId < 1) {
        showToast('Please enter a valid token ID', 'error');
        return;
    }
    viewToken(tokenId);
}

function viewToken(tokenId) {
    const display = document.getElementById('token-display');
    if (!display) return;
    const fallbackSvg = generateSVGFromTokenId(tokenId);
    const fallbackDataUri = `data:image/svg+xml;base64,${btoa(fallbackSvg)}`;

    display.innerHTML = `
        <div class="token-viewer">
            <h3>${utils.formatTokenId(tokenId)}</h3>
            <div class="token-svg-large">
                <img src="/api/svg/${tokenId}" alt="VOIDMASK ${tokenId}" onerror="this.src='${fallbackDataUri}';" />
            </div>
        </div>
    `;
    display.classList.remove('hidden');
}

function updateNetworkBadge() {
    const badge = document.getElementById('network-badge');
    if (!badge) return;

    const network = CONFIG.NETWORK;
    badge.innerHTML = network === 'mainnet' ? '🟢 Mainnet ⇄' : '🟠 Testnet ⇄';
    
    const priceDisplay = document.getElementById('mint-price');
    if (priceDisplay) priceDisplay.textContent = CONFIG.MIN_FEE_DISPLAY;
}

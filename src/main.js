import { initializeApp } from './ui.js';
import { connectWallet, disconnectWallet, initializeWallet } from './wallet.js';

// App initialization
document.addEventListener('DOMContentLoaded', () => {
    console.log('VOIDMASKS app loading...');
    
    // Initialize wallet first (restore from localStorage if available)
    initializeWallet();
    
    // Initialize UI components
    initializeApp();
    
    // Set up wallet event listeners
    document.getElementById('connect-wallet').addEventListener('click', connectWallet);
    document.getElementById('disconnect-wallet').addEventListener('click', disconnectWallet);
    
    console.log('VOIDMASKS app initialized');
});

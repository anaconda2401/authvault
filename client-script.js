const AUTH_VAULT_URL = "https://your-auth-vault-name.netlify.app"; // UPDATE THIS
const CURRENT_APP_URL = window.location.origin;

function enforceAuthentication() {
    // 1. Check if we just bounced back from Auth Vault
    if (window.location.hash.includes('access_token=')) {
        const params = new URLSearchParams(window.location.hash.substring(1));
        const token = params.get('access_token');
        
        if (token) {
            localStorage.setItem('auth_vault_token', token);
            window.history.replaceState(null, null, window.location.pathname);
        }
    }

    // 2. Check if we have a valid token in storage
    const token = localStorage.getItem('auth_vault_token');
    
    if (!token) {
        // Redirect to Auth Vault's gatekeeper
        window.location.href = `${AUTH_VAULT_URL}/.netlify/functions/authorize?redirect_uri=${encodeURIComponent(CURRENT_APP_URL)}`;
    }
}

function triggerLogout() {
    localStorage.removeItem('auth_vault_token');
    window.location.href = `${AUTH_VAULT_URL}/.netlify/functions/logout?redirect_uri=${encodeURIComponent(CURRENT_APP_URL)}`;
}

// Run immediately to protect the page
enforceAuthentication();
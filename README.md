# 🔐 Auth Vault: Serverless Cross-Domain SSO

Auth Vault is a lightweight, centralized Single Sign-On (SSO) authentication system designed to manage access across multiple independent domains (e.g., Vercel, Render, PythonAnywhere) without the need for complex IAM infrastructure or heavy backend middleware.

Built using Netlify Serverless Functions and Supabase, it relies on a pure client-side redirect flow using URL Hash Fragments and custom RS256 JWTs to securely bypass modern third-party cookie restrictions.

## 🚀 Key Features

* **Cross-Domain Compatibility:** Seamlessly authenticate users across entirely different top-level domains.
* **Zero-Middleware Frontend Flow:** Client applications only need a drop-in JavaScript snippet to enforce authentication.
* **Asymmetric Encryption (RS256):** Uses a Private/Public key pair. Auth Vault signs the tokens, and client apps or APIs can independently verify them using the exposed public key endpoint (`/jwks`).
* **Serverless Architecture:** Fast, highly available, and requires zero active server maintenance.
* **Secure Redirects:** Tokens are delivered via URL Hash Fragments (`#access_token=`) to prevent query string logging, and cross-origin checks prevent open-redirect attacks.

## 🏗️ Architecture Stack

* **Host:** Netlify (Serverless Functions)
* **Runtime:** Node.js
* **Database/Auth Provider:** Supabase (PostgreSQL)
* **Token Standard:** Custom JSON Web Tokens (jsonwebtoken)

## 🛠️ Setup & Installation

### 1. Prerequisites
* A Netlify account.
* A Supabase project.
* Node.js installed locally.

### 2. Generate RSA Keys
Auth Vault requires an RSA key pair to sign and verify tokens securely. A local generation script is included:
```bash
npm install
npm run generate-keys
```
*This will generate `jwtRS256.key` (Private) and `jwtRS256.key.pub` (Public). Do not commit these files to version control.*

### 3. Environment Variables
Create a `.env` file in the root directory (or configure them directly in your Netlify dashboard) with the following variables:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Paste the ENTIRE contents of your generated keys below
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----"

JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----
...
-----END PUBLIC KEY-----"
```

### 4. Configure Allowed Origins
To prevent unauthorized domains from requesting tokens, update the `allowedOrigins` array in both `netlify/functions/login.js` and `netlify/functions/authorize.js` with your specific application URLs.

```javascript
const allowedOrigins = [
  "http://localhost:3000",
  "[https://your-frontend-app.vercel.app](https://your-frontend-app.vercel.app)",
  "[https://your-backend-api.onrender.com](https://your-backend-api.onrender.com)"
];
```

### 5. Deploy
Connect this repository to Netlify and deploy. Ensure the `Publish directory` is set to `public` and the `Functions directory` is set to `netlify/functions`. No build command is required.

## 💻 Client-Side Integration

To protect a frontend application, drop the following JavaScript snippet into the `<head>` of your HTML document. 

```javascript
const AUTH_VAULT_URL = "[https://your-auth-vault.netlify.app](https://your-auth-vault.netlify.app)"; 
const CURRENT_APP_URL = window.location.origin + window.location.pathname;

function enforceAuthentication() {
    // 1. Capture token from redirect hash
    if (window.location.hash.includes('access_token=')) {
        const params = new URLSearchParams(window.location.hash.substring(1));
        const token = params.get('access_token');
        if (token) {
            localStorage.setItem('auth_vault_token', token);
            window.history.replaceState(null, null, window.location.pathname);
        }
    }

    // 2. Verify token exists
    const token = localStorage.getItem('auth_vault_token');
    if (!token) {
        window.location.href = `${AUTH_VAULT_URL}/.netlify/functions/authorize?redirect_uri=${encodeURIComponent(CURRENT_APP_URL)}`;
        return false;
    }
    
    document.body.style.display = 'flex'; // Unhide UI
    return true;
}

// Halt script execution if unauthenticated
const IS_AUTHENTICATED = enforceAuthentication();
```
*(Ensure your `<body>` tag has `style="display: none;"` to prevent a flash of unauthenticated content before the redirect occurs).*

## 🔒 Security Notes

* **Never** share or commit your `JWT_PRIVATE_KEY` or `.env` file.
* Tokens are stored in memory/localStorage. Ensure your client applications are protected against Cross-Site Scripting (XSS) attacks.

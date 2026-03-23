# 🔐 Auth Vault: Serverless Cross-Domain SSO

Auth Vault is a lightweight, centralized Single Sign-On (SSO) authentication system designed to manage access across multiple independent domains (e.g., Vercel, Render, PythonAnywhere) without the need for complex IAM infrastructure or heavy backend middleware.

Built using Netlify Serverless Functions and Supabase, it relies on a pure client-side redirect flow using URL Hash Fragments and custom RS256 JWTs to securely bypass modern third-party cookie restrictions.

## 🚀 Key Features

* **Cross-Domain Compatibility:** Seamlessly authenticate users across entirely different top-level domains.
* **Dynamic Whitelisting:** Add or remove allowed client applications instantly via a Supabase database table—no code changes or Netlify redeploys required.
* **Zero-Middleware Frontend Flow:** Client applications only need a drop-in JavaScript snippet to enforce authentication.
* **Asymmetric Encryption (RS256):** Uses a Private/Public key pair. Auth Vault signs the tokens, and client apps or APIs can independently verify them using the exposed public key.
* **Serverless Architecture:** Fast, highly available, and requires zero active server maintenance.
* **Secure Redirects:** Tokens are delivered via URL Hash Fragments (`#access_token=`) to prevent query string logging, and cross-origin database checks prevent open-redirect attacks.

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

### 4. Configure Allowed Origins (Supabase Database)
To prevent unauthorized domains from requesting tokens, Auth Vault checks a database table before authenticating. Run this SQL command in your Supabase SQL Editor to set up the whitelist:

```sql
CREATE TABLE allowed_origins (
  id SERIAL PRIMARY KEY,
  origin TEXT NOT NULL UNIQUE
);

-- Insert your authorized application URLs
INSERT INTO allowed_origins (origin) VALUES 
  ('http://localhost:5000'),
  ('[https://your-frontend-app.vercel.app](https://your-frontend-app.vercel.app)'),
  ('[https://your-backend-api.onrender.com](https://your-backend-api.onrender.com)');
```
*Note: You can add new apps to this table at any time to instantly grant them SSO access.*

### 5. Deploy
Connect this repository to Netlify and deploy. Ensure the `Publish directory` is set to `public` and the `Functions directory` is set to `netlify/functions`. No build command is required.

## 💻 Integration Guides

### Frontend Integration (JavaScript)
To protect a frontend application, drop the following JavaScript snippet into your HTML document. 

```javascript
const AUTH_URL = "[https://your-auth-vault.netlify.app](https://your-auth-vault.netlify.app)"; 
const APP_URL = window.location.origin + window.location.pathname;

// 1. Capture token from redirect hash
if (window.location.hash.includes('access_token=')) {
    localStorage.setItem('auth_vault_token', new URLSearchParams(window.location.hash.substring(1)).get('access_token'));
    window.history.replaceState(null, null, window.location.pathname);
}

// 2. Gatekeeper Check
if (!localStorage.getItem('auth_vault_token')) {
    window.location.href = `${AUTH_URL}/.netlify/functions/authorize?redirect_uri=${encodeURIComponent(APP_URL)}`;
} else {
    document.body.style.display = 'flex'; // Unhide UI
    // Initialize your app here
}

function triggerLogout() {
    localStorage.removeItem('auth_vault_token');
    window.location.href = `${AUTH_URL}/.netlify/functions/logout?redirect_uri=${encodeURIComponent(APP_URL)}`;
}
```
*(Ensure your `<body>` tag has `style="display: none;"` to prevent a flash of unauthenticated content before the redirect occurs).*

### Backend API Verification (Python/Flask Example)
Because Auth Vault uses RS256, your backend APIs do not need to contact the Auth Vault server to verify users. They only need the Public Key.

```python
import jwt
from flask import request

AUTH_VAULT_PUBLIC_KEY = """-----BEGIN PUBLIC KEY-----
...
-----END PUBLIC KEY-----"""

def verify_token(req):
    auth_header = req.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return False
        
    token = auth_header.split(" ")[1]
    try:
        # Securely decode using the public key and RS256
        payload = jwt.decode(token, AUTH_VAULT_PUBLIC_KEY, algorithms=["RS256"])
        return payload # Contains user ID and email
    except Exception:
        return False
```

## 🔒 Security Notes

* **Never** share or commit your `JWT_PRIVATE_KEY` or `.env` file.
* Tokens are stored in memory/localStorage. Ensure your client applications are protected against Cross-Site Scripting (XSS) attacks.
* Keep your Supabase `allowed_origins` table strict. Do not use wildcards.

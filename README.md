# 🔐 Auth Vault

**Auth Vault** is a lightweight, centralized **Single Sign-On (SSO) authentication service** built on top of [Netlify Functions](https://docs.netlify.com/functions/overview/) and [Supabase](https://supabase.com/). It acts as a single trusted identity gateway for multiple web applications — once a user logs in through Auth Vault, they can seamlessly access any connected application without logging in again.

It uses **RS256 (RSA-signed) JWTs** for secure, stateless token issuance, and a **dynamic origin whitelist** stored in Supabase to control which applications are allowed to request authentication.

---

## ✨ Features

- 🏛️ **Centralized SSO** — One login page, multiple protected apps
- 🔑 **RS256 JWT Tokens** — Asymmetric signing; only Auth Vault can issue tokens, any app can verify them
- 🌐 **Dynamic Origin Whitelist** — Allowed application origins are managed in a Supabase database table, no code redeploy needed
- 🍪 **Persistent Session Cookie** — `vault_session` HttpOnly cookie allows returning users to skip re-authentication automatically
- 🚪 **JWKS Endpoint** — Public key exposed at `/.well-known/jwks.json` so client apps can independently verify tokens
- 📦 **Serverless** — Runs entirely on Netlify Functions, zero server management
- 📱 **Responsive Login UI** — Clean, dark-themed login page that works on mobile and desktop

---

## 🏗️ Architecture Overview

```
  [Client App]  ──── redirects to ──────►  [Auth Vault: /authorize]
                                                    │
                                      Has valid     │  No valid
                                      session?      │  session?
                                          │         │
                                          │         ▼
                                          │   [Login Page: /index.html]
                                          │         │
                                          │    User submits email + password
                                          │         │
                                          │         ▼
                                          │   [Auth Vault: /login]
                                          │   ├─ Validate redirect_uri vs Supabase whitelist
                                          │   ├─ Authenticate user via Supabase Auth
                                          │   ├─ Sign RS256 JWT (12h expiry)
                                          │   └─ Set `vault_session` cookie
                                          │         │
                                          └────◄────┘
                                                    │
                                          Redirect to client app
                                          with #access_token=<jwt>
                                                    │
                                                    ▼
                                     [Client App stores token in localStorage]
                                     [Subsequent visits: cookie auto-authorizes]
```

---

## 📁 Project Structure

```
auth-vault/
├── public/                         # Static frontend assets (served by Netlify)
│   ├── index.html                  # Login page UI (dark-themed, responsive)
│   ├── favicon.ico                 # Browser tab icon
│   ├── favicon-16x16.png
│   ├── favicon-32x32.png
│   ├── apple-touch-icon.png
│   ├── android-chrome-192x192.png
│   ├── android-chrome-512x512.png
│   └── site.webmanifest            # PWA manifest
│
├── netlify/
│   └── functions/                  # Netlify serverless functions (the backend)
│       ├── authorize.js            # SSO gatekeeper — checks session, redirects
│       ├── login.js                # Handles credential verification & JWT issuance
│       ├── logout.js               # Clears the session cookie
│       └── jwks.js                 # Exposes the RSA public key for token verification
│
├── client-script.js                # Drop-in JS snippet for client apps to integrate Auth Vault
├── generate-keys.js                # One-time utility to generate the RSA-2048 key pair
├── netlify.toml                    # Netlify build & routing configuration
├── package.json                    # Node.js dependencies
├── jwtRS256.key                    # ⚠️ RSA Private Key (NOT committed to git)
├── jwtRS256.key.pub                # ⚠️ RSA Public Key  (NOT committed to git)
└── .env                            # ⚠️ Environment secrets (NOT committed to git)
```

---

## ⚙️ How It Works — Endpoint Reference

### `GET /.netlify/functions/authorize`

The **SSO entry point**. Client apps redirect users here.

| Query Parameter | Description |
|---|---|
| `redirect_uri` | The URL of the client app to return the user to after login |

**Behavior:**
1. Checks for a valid `vault_session` cookie (existing session).
2. If valid → immediately redirects back to `redirect_uri#access_token=<jwt>`.
3. If no session → redirects to `/index.html?redirect_uri=...` to show the login form.

---

### `POST /.netlify/functions/login`

The **authentication handler**. Called by the login form submission.

| Form Field | Description |
|---|---|
| `email` | User's email address |
| `password` | User's password |
| `redirect_uri` | The client app URL (passed through from the login page) |

**Behavior:**
1. Fetches the dynamic origin whitelist from the `allowed_origins` table in Supabase.
2. Validates that `redirect_uri` matches a whitelisted origin — **returns `403` if not**.
3. Authenticates the user via `supabase.auth.signInWithPassword()`.
4. Signs a custom **RS256 JWT** (12-hour expiry, issuer: `"auth-vault"`) containing `sub` (user ID) and `email`.
5. Sets a `vault_session` **HttpOnly, Secure, SameSite=Lax** cookie (12-hour expiry).
6. Redirects back to `redirect_uri#access_token=<jwt>`.

---

### `GET /.netlify/functions/logout`

**Clears the SSO session.**

| Query Parameter | Description |
|---|---|
| `redirect_uri` | Where to redirect after logout (typically back to the client app) |

**Behavior:** Expires the `vault_session` cookie and redirects.

---

### `GET /.well-known/jwks.json`

**Public key discovery endpoint** (proxied to `/.netlify/functions/jwks`).

Returns the RSA public key in JSON format so client apps can independently verify JWTs without calling Auth Vault:

```json
{
  "keys": [
    {
      "alg": "RS256",
      "kty": "RSA",
      "use": "sig",
      "pem": "-----BEGIN PUBLIC KEY-----\n..."
    }
  ]
}
```

---

## 🛠️ Setup & Deployment

### 1. Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- A [Supabase](https://supabase.com/) project with **Email Auth enabled**
- A [Netlify](https://netlify.com/) account

---

### 2. Generate RSA Keys

```bash
npm install
npm run generate-keys
```

This creates `jwtRS256.key` (private) and `jwtRS256.key.pub` (public) in the project root. **These files are gitignored and must never be committed.**

---

### 3. Configure Supabase

**A. Enable Email Auth**  
In your Supabase dashboard → Authentication → Providers → Email → ensure it is enabled.

**B. Create the origin whitelist table**  
Run the following SQL in the Supabase SQL Editor:

```sql
CREATE TABLE allowed_origins (
  id SERIAL PRIMARY KEY,
  origin TEXT NOT NULL UNIQUE
);

-- Example: add your client app(s)
INSERT INTO allowed_origins (origin) VALUES
  ('https://my-app.vercel.app'),
  ('https://another-app.netlify.app');
```

**C. Add your admin user(s)**  
In Supabase dashboard → Authentication → Users → "Invite user" or use the Supabase admin API.

---

### 4. Set Environment Variables in Netlify

In your Netlify site dashboard → **Site configuration → Environment variables**, add:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL (e.g. `https://xxxx.supabase.co`) |
| `SUPABASE_ANON_KEY` | Your Supabase project's `anon` public key |
| `JWT_PRIVATE_KEY` | The **full contents** of `jwtRS256.key` — replace actual newlines with `\n` |
| `JWT_PUBLIC_KEY` | The **full contents** of `jwtRS256.key.pub` — replace actual newlines with `\n` |

> **Tip:** To correctly format the key for Netlify's env var UI, copy the key content and replace each line break with the literal characters `\n`.

---

### 5. Deploy to Netlify

```bash
# Connect your repo to Netlify via the dashboard, or use the CLI:
npx netlify-cli deploy --prod
```

Netlify will automatically detect `netlify.toml` and:
- Serve `public/` as the static site root
- Deploy functions from `netlify/functions/`
- Set up the `/.well-known/jwks.json` redirect

---

## 🔌 Integrating Auth Vault into a Client App

Copy `client-script.js` into your client application and update the `AUTH_VAULT_URL` constant:

```js
// client-script.js
const AUTH_VAULT_URL = "https://your-auth-vault-name.netlify.app"; // ← UPDATE THIS
const CURRENT_APP_URL = window.location.origin;

function enforceAuthentication() {
    // Capture token from URL hash after redirect
    if (window.location.hash.includes('access_token=')) {
        const params = new URLSearchParams(window.location.hash.substring(1));
        const token = params.get('access_token');
        if (token) {
            localStorage.setItem('auth_vault_token', token);
            window.history.replaceState(null, null, window.location.pathname);
        }
    }

    // If no token in storage, redirect to Auth Vault
    const token = localStorage.getItem('auth_vault_token');
    if (!token) {
        window.location.href = `${AUTH_VAULT_URL}/.netlify/functions/authorize?redirect_uri=${encodeURIComponent(CURRENT_APP_URL)}`;
    }
}

function triggerLogout() {
    localStorage.removeItem('auth_vault_token');
    window.location.href = `${AUTH_VAULT_URL}/.netlify/functions/logout?redirect_uri=${encodeURIComponent(CURRENT_APP_URL)}`;
}

// Run immediately to protect the page
enforceAuthentication();
```

**Include it in your HTML before any other scripts:**
```html
<script src="client-script.js"></script>
```

**Verifying the JWT on your client (optional but recommended):**
```js
// Fetch the public key from Auth Vault's JWKS endpoint
const res = await fetch('https://your-auth-vault-name.netlify.app/.well-known/jwks.json');
const { keys } = await res.json();
// Use a JWT library (e.g. jose) to verify the token stored in localStorage
```

---

## 🔒 Security Design Notes

| Concern | How Auth Vault Handles It |
|---|---|
| **Token Forgery** | RS256 asymmetric signing — only the private key (server-side only) can create valid tokens |
| **Unauthorized App Redirects** | `redirect_uri` is validated against the Supabase `allowed_origins` table on every login |
| **Session Hijacking** | `vault_session` cookie is `HttpOnly` (JS-inaccessible), `Secure` (HTTPS only), and `SameSite=Lax` |
| **Token Expiry** | JWTs expire in 12 hours; the cookie also expires in 12 hours (`Max-Age=43200`) |
| **Key Exposure** | RSA keys are stored as Netlify environment variables, never in the codebase or git |
| **Replay Attacks** | Short-lived tokens (12h) limit the window of exposure for any intercepted token |

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| **Hosting & Functions** | [Netlify](https://netlify.com/) (Serverless Functions) |
| **Database & Auth** | [Supabase](https://supabase.com/) (PostgreSQL + Auth) |
| **Token Signing** | [`jsonwebtoken`](https://github.com/auth0/node-jsonwebtoken) (RS256 / RSA-2048) |
| **Frontend** | Vanilla HTML + CSS (dark-themed, responsive) |
| **Key Generation** | Node.js built-in `crypto` module |

---

## 📜 Available Scripts

| Command | Description |
|---|---|
| `npm run generate-keys` | Generates a new RSA-2048 key pair (`jwtRS256.key` + `jwtRS256.key.pub`) |

---

## ⚠️ Important Notes

- **Never commit** `jwtRS256.key`, `jwtRS256.key.pub`, or `.env` to version control. They are listed in `.gitignore`.
- If you rotate your RSA keys, **all existing JWTs will become invalid** immediately. All logged-in users across all connected apps will be signed out.
- The `allowed_origins` table in Supabase uses Row Level Security (RLS) — make sure your `anon` key has `SELECT` access to that table, or disable RLS on it as appropriate for your security model.
- The JWKS endpoint (`/.well-known/jwks.json`) returns the public key in a non-standard `pem` format rather than the standard JWK `n`/`e` parameters. Adjust your token verification library accordingly if needed.

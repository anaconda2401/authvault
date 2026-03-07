const { createClient } = require('@supabase/supabase-js');
const jwt = require("jsonwebtoken");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  const params = new URLSearchParams(event.body);
  const email = params.get("email");
  const password = params.get("password");
  const redirect_uri = params.get("redirect_uri");

  // 1. Verify Allowed Origins
  const allowedOrigins = [
    "https://whiteshadow24.pythonanywhere.com",
    "https://anaconda.pythonanywhere.com",
    "https://devtest.onrender.com",
    "https://ai-dashboard.vercel.app",
    "http://localhost:8888",
    "http://localhost:5000",
    "http://localhost:3000"
  ];
  
  const isValidOrigin = allowedOrigins.includes(redirect_uri) || 
                        allowedOrigins.some(origin => redirect_uri.startsWith(origin + '/'));
                        
  if (!isValidOrigin) {
    return { statusCode: 400, body: "Unauthorized redirect URI" };
  }

  // 2. Authenticate
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { statusCode: 401, body: `Unauthorized: ${error.message}` };

  // 3. Generate Custom RS256 JWT
  const privateKey = process.env.JWT_PRIVATE_KEY.replace(/\\n/g, '\n');
  const token = jwt.sign(
    { sub: data.user.id, email: data.user.email },
    privateKey,
    { algorithm: "RS256", expiresIn: "12h", issuer: "auth.myapp.netlify.app" }
  );

  // 4. Redirect AND set the session cookie
  return {
    statusCode: 302,
    headers: {
      "Set-Cookie": `vault_session=${token}; Secure; HttpOnly; SameSite=Lax; Max-Age=43200; Path=/`,
      "Location": `${redirect_uri}#access_token=${token}`,
      "Cache-Control": "no-store, no-cache, must-revalidate"
    }
  };
};
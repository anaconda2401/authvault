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

  // 1. Fetch Dynamic Whitelist from Supabase
  const { data: whitelist, error: dbError } = await supabase
    .from('allowed_origins')
    .select('origin');

  if (dbError) {
    console.error("Supabase Error:", dbError);
    return { statusCode: 500, body: "Internal Server Error" };
  }

  // Extract origins into a flat array
  const allowedOrigins = whitelist.map(row => row.origin);

  // Verify the redirect URI against the Supabase list
  const isValidOrigin = allowedOrigins.includes(redirect_uri) || 
                        allowedOrigins.some(origin => redirect_uri.startsWith(origin + '/'));
                        
  if (!isValidOrigin) {
    return { statusCode: 403, body: "Unauthorized Application Origin" };
  }

  // 2. Authenticate User
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  
  if (authError) {
    // Redirect back to login with an error flag (optional UX improvement)
    return { statusCode: 401, body: `Unauthorized: ${authError.message}` };
  }

  // 3. Generate Custom RS256 JWT
  // Note: Ensure your private key is formatted correctly in the Netlify UI (use \n for line breaks if needed)
  const privateKey = process.env.JWT_PRIVATE_KEY.replace(/\\n/g, '\n');
  
  const token = jwt.sign(
    { 
      sub: authData.user.id, 
      email: authData.user.email 
    },
    privateKey,
    { 
      algorithm: "RS256", 
      expiresIn: "12h", 
      issuer: "auth-vault" 
    }
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
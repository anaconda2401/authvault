const jwt = require("jsonwebtoken");

exports.handler = async (event) => {
  const redirect_uri = event.queryStringParameters?.redirect_uri || "/";
  const cookieHeader = event.headers.cookie || "";

  // Check for the vault_session cookie
  const match = cookieHeader.match(/vault_session=([^;]+)/);
  const sessionToken = match ? match[1] : null;

  if (sessionToken) {
    try {
      const publicKey = process.env.JWT_PUBLIC_KEY.replace(/\\n/g, '\n');
      jwt.verify(sessionToken, publicKey);
      
      // Valid session found! Redirect immediately with the token
      return {
        statusCode: 302,
        headers: { 
          Location: `${redirect_uri}#access_token=${sessionToken}`,
          "Cache-Control": "no-store"
        }
      };
    } catch (err) {
      // Token expired or invalid, proceed to login page
    }
  }

  // No valid session, show the login UI
  return {
    statusCode: 302,
    headers: { 
      Location: `/index.html?redirect_uri=${encodeURIComponent(redirect_uri)}`,
      "Cache-Control": "no-store"
    }
  };
};
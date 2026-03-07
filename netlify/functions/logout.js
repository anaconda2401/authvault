exports.handler = async (event) => {
  const redirect_uri = event.queryStringParameters?.redirect_uri || "/";

  return {
    statusCode: 302,
    headers: {
      "Set-Cookie": "vault_session=; Secure; HttpOnly; SameSite=Lax; Max-Age=0; Path=/",
      "Location": redirect_uri,
      "Cache-Control": "no-store"
    }
  };
};
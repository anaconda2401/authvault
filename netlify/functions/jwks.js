exports.handler = async () => {
  const publicKey = process.env.JWT_PUBLIC_KEY.replace(/\\n/g, '\n');

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify({
      keys: [{ alg: "RS256", kty: "RSA", use: "sig", pem: publicKey }]
    })
  };
};
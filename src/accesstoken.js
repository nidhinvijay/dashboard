require("dotenv").config();
const KiteConnect = require("kiteconnect").KiteConnect;

const apiKey = process.env.KITE_API_KEY;
const apiSecret = process.env.KITE_API_SECRET;
const requestToken = process.argv[2];

if (!requestToken) {
  console.log("Usage: node scripts/getAccessToken.js <request_token>");
  process.exit(1);
}

const kc = new KiteConnect({ api_key: apiKey });

kc.generateSession(requestToken, apiSecret)
  .then((r) => {
    console.log("ACCESS_TOKEN:", r.access_token);
    console.log("PUBLIC_TOKEN:", r.public_token);
  })
  .catch((err) => {
    console.error("ERROR:", err);
  });

const domain = process.env.DOMAIN;
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET
const serverPort = process.env.SERVER_PORT;
const lineAccessToken = process.env.LINE_ACCESS_TOKEN;

module.exports = {
    domain,
    googleClientId,
    googleClientSecret,
    serverPort,
    lineAccessToken
}
const fs = require('fs');
const { authorize } = require('./googleApi');
const { connectToWhatsApp } = require('./whatsapp');
const { TOKEN_PATH, credentials } = require('./config');

async function main() {
    if (fs.existsSync(TOKEN_PATH)) {
        const oAuth2Client = await authorize(credentials);
        await connectToWhatsApp(oAuth2Client);
    } else {
        await authorize(credentials);
    }
}

main().catch(console.error);

// googleApi.js
const { google } = require('googleapis');
const fs = require('fs');
const { SCOPES, TOKEN_PATH, credentials } = require('./config');
const { getProfileName } = require('./utils'); // Importa getProfileName desde utils.js
const { getTimeDifferenceFromCountry, getCountryFromDescription, getEventType, getMessageBasedOnTitle, isValidMeeting } = require('./helpers'); // Importa funciones desde helpers.js

const UNREGISTERED_NUMBERS_FILE = './unregisteredNumbers.json';

// Leer números no registrados desde el archivo
function loadUnregisteredNumbers() {
    if (fs.existsSync(UNREGISTERED_NUMBERS_FILE)) {
        const content = fs.readFileSync(UNREGISTERED_NUMBERS_FILE, 'utf8');
        try {
            return JSON.parse(content).unregisteredNumbers || [];
        } catch (error) {
            console.error('Error al escribir en unregisteredNumbers.json:', error);
            return [];
        }
    }
    return [];
}

// Guardar números no registrados en el archivo
function saveUnregisteredNumbers(numbers) {
    fs.writeFileSync(UNREGISTERED_NUMBERS_FILE, JSON.stringify({ unregisteredNumbers: numbers }, null, 2));
}

// Nueva función para verificar si el número está en WhatsApp y obtener el JID
async function checkWhatsAppNumber(sock, phoneNumber, title) {
    const [result] = await sock.onWhatsApp(phoneNumber);
    if (result && result.exists) {
        return { userId: result.jid, title };
    } else {
        console.log(`Número no registrado en WhatsApp: ${phoneNumber}`);
        let unregisteredNumbers = loadUnregisteredNumbers();
        if (!unregisteredNumbers.some(entry => entry.phoneNumber === phoneNumber)) {
            unregisteredNumbers.push({ phoneNumber, title });
            saveUnregisteredNumbers(unregisteredNumbers);
        }
        return { userId: null, title };
    }
}


async function authorize(credentials, code = null) {
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    if (code) {
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
        console.log('Token stored to', TOKEN_PATH);
        return oAuth2Client;
    }

    if (fs.existsSync(TOKEN_PATH)) {
        const token = fs.readFileSync(TOKEN_PATH);
        oAuth2Client.setCredentials(JSON.parse(token));
        return oAuth2Client;
    }

    return getNewToken(oAuth2Client);
}

async function getNewToken(oAuth2Client) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Autorice la app entrando a este link:', authUrl);
    const { sendAuthUrl } = require('./whatsapp'); // Importa sendAuthUrl aquí
    await sendAuthUrl(authUrl);
    return oAuth2Client;
}

module.exports = {
    authorize,
    getNewToken,
    getMessageBasedOnTitle,
    checkWhatsAppNumber,
    getCountryFromDescription,
    getEventType,
    isValidMeeting,
    loadUnregisteredNumbers,
    saveUnregisteredNumbers
};

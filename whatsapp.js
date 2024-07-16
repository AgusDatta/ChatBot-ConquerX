const { makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const P = require('pino');
const QRCode = require('qrcode-terminal');
const googleApi = require('./googleApi');
const { credentials } = require('./config');
const fs = require('fs');
const { getProfileName } = require('./utils');
const { listEvents } = require('./listEvents');

const CONTACTED_USERS_FILE = './contactedUsers.json';
const MAIN_CONTACT = '5491126320824@s.whatsapp.net';
let contactedUsers = [];

function loadContactedUsers() {
    if (fs.existsSync(CONTACTED_USERS_FILE)) {
        contactedUsers = JSON.parse(fs.readFileSync(CONTACTED_USERS_FILE, 'utf8')).contactedUsers;
    }
}

function saveContactedUsers() {
    fs.writeFileSync(CONTACTED_USERS_FILE, JSON.stringify({ contactedUsers }, null, 2));
}

function isUserContacted(userId, eventId) {
    return contactedUsers.some(user => user.userId === userId && user.eventId === eventId);
}

function addUserToContacted(userId, eventId) {
    contactedUsers.push({ userId, eventId });
    saveContactedUsers();
}

async function sendAuthUrl(authUrl) {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: P({ level: 'warn' }),
        browser: ['Baileys', 'Chrome', '1.0.0'],
    });

    try {
        await sock.sendMessage(MAIN_CONTACT, { text: `Loguea en la app ingresando a este link: ${authUrl}` });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('messages.upsert', async (m) => {
            const message = m.messages[0];
            if (!message.message) return;
            const messageContent = message.message.conversation || message.message.extendedTextMessage?.text;

            const userId = message.key.remoteJid;

            if (message.key.fromMe) return;

            if (messageContent && userId === MAIN_CONTACT) {
                console.log('Received auth code:', messageContent.trim());
                const oAuth2Client = await googleApi.authorize(credentials, messageContent.trim());
                sock.end();
                connectToWhatsApp(oAuth2Client);
            }
        });
    } catch (error) {
        console.error('Error enviando auth URL:', error);
    }
}

async function connectToWhatsApp(oAuth2Client) {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: P({ level: 'warn' }),
        browser: ['Baileys', 'Chrome', '1.0.0'],
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp(oAuth2Client);
            }
        } else if (connection === 'open') {
            console.log('Conectado exitosamente con el proveedor');
            await sock.sendMessage(MAIN_CONTACT, { text: 'Bot online y listo para funcionar.' });
        }

        if (qr) {
            QRCode.generate(qr, { small: true });
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        const message = m.messages[0];
        if (!message.message) return;
        const messageType = Object.keys(message.message)[0];
        const messageContent = message.message.conversation || message.message.extendedTextMessage?.text;

        const userId = message.key.remoteJid;

        if (message.key.fromMe) return;

        if (messageType === 'conversation' || messageType === 'extendedTextMessage') {
            if (messageContent.toLowerCase() === 'start') {
                await sock.sendMessage(MAIN_CONTACT, { text: 'Comando "start" recibido. Chequeando eventos y enviando mensajes...' });
                await notifyNextEvents(sock, userId, oAuth2Client, getProfileName);
            }
        }
    });

    async function notifyNextEvents(sock, userId, authClient, getProfileName) {
        const profileName = await getProfileName(authClient);
        const { validEvents: upcomingEvents, invalidMeetingsDetails } = await listEvents(authClient, profileName, sock) || { validEvents: [], invalidMeetingsDetails: [] };
    
        let sentMessagesCount = 0;
        let sentMessagesDetails = '';
        let notSentNumbers = [];
    
        if (upcomingEvents.length > 0) {
            for (const event of upcomingEvents) {
                if (!isUserContacted(event.userId, event.eventId)) {
                    const dynamicMessagePart = event.dynamicMessagePart;
    
                    let messages = [];
                    if (event.country === 'Canada/EEUU' || event.country === 'México') {
                        messages = [
                            { text: dynamicMessagePart },
                            { text: 'Te escribo para confirmar que tenemos agendada una sesión de claridad para el día y horario pactado.' },
                            { text: 'Confírmame cuando leas el mensaje para enviarte el enlace de Google Meet y un PDF con información importante 💻' }
                        ];
                    } else {
                        messages = [
                            { text: dynamicMessagePart },
                            { text: `Te escribo para confirmar que tenemos agendada una sesión de claridad para el *Día: ${event.day} (${event.weekday}) - A las ${event.time} horas de ${event.country}*.` },
                            { text: 'Confírmame cuando leas el mensaje para enviarte el enlace de Google Meet y un PDF con información importante 💻' }
                        ];
                    }
    
                    for (const message of messages) {
                        await sock.sendMessage(event.userId, { text: message.text });
                    }
    
                    addUserToContacted(event.userId, event.eventId);
                    sentMessagesCount++;
                    sentMessagesDetails += `Mensaje enviado a ${event.userId.split('@')[0]}\n`;
                } else {
                    notSentNumbers.push(event.userId.split('@')[0]);
                }
            }
        } else {
            console.log('No se encontraron eventos.');
            await sock.sendMessage(MAIN_CONTACT, { text: 'No se encontraron eventos.' });
        }
    
        let unregisteredNumbers = googleApi.loadUnregisteredNumbers();
    
        if (sentMessagesCount > 0) {
            let sentMessage = `Mensajes enviados a ${sentMessagesCount} próximo(s) evento(s).\n\n${sentMessagesDetails}`;
            await sock.sendMessage(MAIN_CONTACT, { text: sentMessage });
        }
    
        if (notSentNumbers.length > 0) {
            let notSentMessage = `No se enviaron mensajes a los siguientes números porque ya se les envió previamente:\n\n${notSentNumbers.join('\n')}`;
            await sock.sendMessage(MAIN_CONTACT, { text: notSentMessage });
        }
    
        if (unregisteredNumbers.length > 0) {
            const unregisteredDetails = unregisteredNumbers.map(entry => `${entry.phoneNumber} - ${entry.title}`).join('\n');
            await sock.sendMessage(MAIN_CONTACT, { text: `Números no registrados en WhatsApp:\n${unregisteredDetails}` });
        }
    
        if (invalidMeetingsDetails.length > 0) {
            await sock.sendMessage(MAIN_CONTACT, { text: `Reuniones no válidas:\n${invalidMeetingsDetails.join('\n')}` });
        }
    
        googleApi.saveUnregisteredNumbers([]);
    }
    
}

module.exports = { sendAuthUrl, connectToWhatsApp };

loadContactedUsers();

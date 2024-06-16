const { makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const P = require('pino');
const QRCode = require('qrcode-terminal');
const googleApi = require('./googleApi'); // Importa el módulo entero
const { credentials } = require('./config');
const fs = require('fs');
const { getProfileName } = require('./utils'); // Importa getProfileName desde utils.js
const { listEvents } = require('./listEvents'); // Importa listEvents desde listEvents.js

const CONTACTED_USERS_FILE = './contactedUsers.json';
const MAIN_CONTACT = '5491126320824@s.whatsapp.net';
let contactedUsers = [];
let invalidMeetingsDetails = ''; // Variable para almacenar detalles de reuniones no válidas

// Load contacted users from file
function loadContactedUsers() {
    if (fs.existsSync(CONTACTED_USERS_FILE)) {
        contactedUsers = JSON.parse(fs.readFileSync(CONTACTED_USERS_FILE, 'utf8')).contactedUsers;
    }
}

// Save contacted users to file
function saveContactedUsers() {
    fs.writeFileSync(CONTACTED_USERS_FILE, JSON.stringify({ contactedUsers }, null, 2));
}

// Check if user has already been contacted
function isUserContacted(userId, eventId) {
    return contactedUsers.some(user => user.userId === userId && user.eventId === eventId);
}

// Add user to contacted list
function addUserToContacted(userId, eventId) {
    contactedUsers.push({ userId, eventId });
    saveContactedUsers();
}

async function sendAuthUrl(authUrl) {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: P({ level: 'warn' }), // Cambiar a 'error' para silenciar más mensajes
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

            // Verificar si el mensaje fue enviado por el propio bot
            if (message.key.fromMe) return;

            // Obtener el código de autenticación del usuario
            if (messageContent && userId === MAIN_CONTACT) {
                console.log('Received auth code:', messageContent.trim());
                const oAuth2Client = await googleApi.authorize(credentials, messageContent.trim());
                sock.end(); // Desconectar el socket después de obtener el token
                connectToWhatsApp(oAuth2Client); // Conectar con WhatsApp usando el nuevo token
            }
        });
    } catch (error) {
        console.error('Error sending auth URL:', error);
    }
}

async function connectToWhatsApp(oAuth2Client) {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: P({ level: 'warn' }), // Cambiar a 'error' para silenciar más mensajes
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

        // Verificar si el mensaje fue enviado por el propio bot
        if (message.key.fromMe) return;

        // Iniciar el flujo solo cuando se recibe "start"
        if (messageType === 'conversation' || messageType === 'extendedTextMessage') {
            if (messageContent.toLowerCase() === 'start') {
                await sock.sendMessage(MAIN_CONTACT, { text: 'Comando "start" recibido. Chequeando eventos y enviando mensajes...' });
                await notifyNextEvents(sock, userId, oAuth2Client, getProfileName);
            }
        }
    });

    async function notifyNextEvents(sock, userId, authClient, getProfileName) {
        const profileName = await getProfileName(authClient);
        const upcomingEvents = await listEvents(authClient, profileName, sock) || []; // Pasar profileName y sock
    
        let sentMessagesCount = 0; // Contador de mensajes enviados
        let sentMessagesDetails = ''; // Detalles de los mensajes enviados
        let notSentMessagesDetails = ''; // Detalles de los mensajes no enviados
        let invalidMeetingsDetails = ''; // Detalles de las reuniones no válidas
    
        if (upcomingEvents.length > 0) {
            for (const event of upcomingEvents) {
                if (!isUserContacted(event.userId, event.eventId)) {
                    const dynamicMessagePart = event.dynamicMessagePart; // Obtener mensaje dinámico ya procesado
    
                    // Mensajes dependiendo del país
                    let messages = [];
                    if (event.country === 'Canada/EEUU') {
                        messages = [
                            { text: dynamicMessagePart },
                            { text: 'Te escribo para confirmar que tenemos agendada una sesión de claridad para el día y horario pactado.' },
                            { text: 'Confírmame cuando leas el mensaje para enviarte el enlace de Google Meet y un PDF con información importante 💻' }
                        ];
                    } else {
                        messages = [
                            { text: dynamicMessagePart },
                            { text: `Te escribo para confirmar que tenemos agendada una sesión de claridad para el Día: ${event.day} (${event.weekday}) - A las ${event.time} horas de ${event.country}.` },
                            { text: 'Confírmame cuando leas el mensaje para enviarte el enlace de Google Meet y un PDF con información importante 💻' }
                        ];
                    }
    
                    for (const message of messages) {
                        await sock.sendMessage(event.userId, { text: message.text });
                    }
    
                    addUserToContacted(event.userId, event.eventId);
                    sentMessagesCount++; // Incrementar el contador
                    sentMessagesDetails += `Mensaje enviado a ${event.userId.split('@')[0]}\n`;
                } else {
                    notSentMessagesDetails += `No se envió mensaje a ${event.userId.split('@')[0]} porque ya se había enviado anteriormente\n`;
                }
            }
        } else {
            console.log('No se encontraron eventos.');
            await sock.sendMessage(MAIN_CONTACT, { text: 'No se encontraron eventos.' });
        }
    
        // Leer números no registrados desde el archivo
        let unregisteredNumbers = googleApi.loadUnregisteredNumbers();
    
        // Consolidar y enviar el mensaje final
        let consolidatedMessage = `Mensajes enviados a ${sentMessagesCount} próximo(s) evento(s).\n\n${sentMessagesDetails}\n${notSentMessagesDetails}`;
    
        if (unregisteredNumbers.length > 0) {
            consolidatedMessage += `\n\nNúmeros no registrados en WhatsApp:\n${unregisteredNumbers.join('\n')}`;
        }
    
        if (invalidMeetingsDetails.length > 0) {
            consolidatedMessage += `\n\nReuniones no válidas:\n${invalidMeetingsDetails}`;
        }
    
        await sock.sendMessage(MAIN_CONTACT, { text: consolidatedMessage });
        // Resetear el archivo de números no registrados después de enviar el mensaje
        googleApi.saveUnregisteredNumbers([]);
    }

    // Ya no se necesita notifyUnregisteredNumbers aquí
}

module.exports = { sendAuthUrl, connectToWhatsApp };

// Load contacted users on startup
loadContactedUsers();

const { google } = require('googleapis');
const fs = require('fs');
const { format, parseISO, addDays, addHours, endOfDay, addWeeks } = require('date-fns');
const { es } = require('date-fns/locale');
const { SCOPES, TOKEN_PATH, credentials } = require('./config');

// Mapeo de prefijos internacionales a países
const countryMapping = {
    '1': 'Canada/EEUU',
    '55': 'Brasil',
    '51': 'Peru',
    '52': 'México',
    '54': 'Argentina',
    '56': 'Chile',
    '57': 'Colombia',
    '58': 'Venezuela',
    '503': 'El Salvador',
    '506': 'Costa Rica',
    '507': 'Panamá',
    '591': 'Bolivia',
    '593': 'Ecuador',
    '595': 'Paraguay',
    '598': 'Uruguay'
};

// Mapeo de diferencia horaria por país
const timeDifferences = {
    'Canada/EEUU': -1,
    'Brasil': 0,
    'Peru': -2,
    'México': -3,
    'Argentina': 0,
    'Chile': -1,
    'Colombia': -2,
    'Venezuela': -1,
    'El Salvador': -3,
    'Costa Rica': -3,
    'Panamá': -2,
    'Bolivia': -1,
    'Ecuador': -2,
    'Paraguay': -1,
    'Uruguay': 0
};

function getTimeDifferenceFromCountry(country) {
    return timeDifferences[country] || 0;
}

function getCountryFromDescription(description) {
    const phoneMatch = description.match(/Enviar mensajes de texto a::?\s?(\+\d[\d\s-]+)/);
    if (phoneMatch) {
        let phoneNumber = phoneMatch[1]; 
        const phonePrefix = phoneNumber.match(/^\+(\d{1,3})/);
        
        if (phonePrefix) {
            const countryCode = phonePrefix[1];
            const country = countryMapping[countryCode] || 'desconocido';
            
            phoneNumber = phoneNumber.replace(/\s+/g, '').replace(/-/g, ''); 

            return { country, phoneNumber };
        }
    }
    return { country: 'desconocido', phoneNumber: '' };
}

function getEventType(summary) {
    if (summary.includes('Formación en Inversión')) {
        return 'Formación';
    } else if (summary.includes('Desarrollo Full-Stack')) {
        return 'Desarrollo';
    }
    return 'Otro';
}

function getMessageBasedOnTitle(name, eventType, profileName) {
    let dynamicMessagePart = '';
    if (eventType === 'Formación') {
        dynamicMessagePart = `Hola ${name} 👋🏻, soy ${profileName} 🙋🏻‍♂️, responsable de admisiones de la Formación en Inversión de ConquerX, encantado de conocerte 😊`;
    } else if (eventType === 'Desarrollo') {
        dynamicMessagePart = `Hola ${name} 👋🏻, soy ${profileName} 🙋🏻‍♂️, responsable de admisiones del Máster en desarrollo Full Stack de Conquer Blocks, encantado de conocerte 😊`;
    }
    return dynamicMessagePart;
}

function isValidMeeting(meeting) {
    const description = meeting.description || '';
    const title = meeting.summary || '';
    const hasPhoneNumber = description.match(/Enviar mensajes de texto a::?\s?(\+\d[\d\s-]+)/);
    const hasValidTitle = title.includes('Formación en Inversión') || title.includes('Desarrollo Full-Stack');
    
    return hasPhoneNumber && hasValidTitle;
}

// Función para notificar números no registrados
async function notifyUnregisteredNumbers(sock, phoneNumber) {
    console.log(`Enviando notificación de número no registrado: ${phoneNumber}`);
    await sock.sendMessage('5491126320824@s.whatsapp.net', { text: `Número no registrado en WhatsApp: ${phoneNumber}` });
}

// Nueva función para verificar si el número está en WhatsApp y obtener el JID
async function checkWhatsAppNumber(sock, phoneNumber) {
    const [result] = await sock.onWhatsApp(phoneNumber);
    if (result && result.exists) {
        return result.jid;
    } else {
        console.log(`Número no registrado en WhatsApp: ${phoneNumber}`);
        await notifyUnregisteredNumbers(sock, phoneNumber);
        return null;
    }
}

async function listEvents(auth, profileName, sock) {
    const calendar = google.calendar({ version: 'v3', auth });
    const res = await calendar.events.list({
        calendarId: 'primary',
        timeMin: (new Date()).toISOString(), // Hora actual
        timeMax: endOfDay(addWeeks(new Date(), 1)).toISOString(), // Final de la semana siguiente
        singleEvents: true,
        orderBy: 'startTime',
    });
    const events = res.data.items;
    if (events.length) {
        return await Promise.all(events.map(async event => {
            // Validar la reunión antes de procesarla
            if (!isValidMeeting(event)) {
                console.log('Reunión no válida, saltando:', event.summary);
                return null;
            }

            // Procesamiento de la reunión válida
            try {
                const start = parseISO(event.start.dateTime || event.start.date);
                let day = format(start, 'd', { locale: es });
                const weekday = format(start, 'EEEE', { locale: es });
                let time = format(start, 'HH:mm', { locale: es });
                const description = event.description || '';
                const summary = event.summary || '';
                const name = summary.split(':')[0].trim();

                // Obtener el país y el número limpio basado en la descripción del evento
                const { country, phoneNumber: cleanedPhoneNumber } = getCountryFromDescription(description);

                // Verificar si el número está en WhatsApp y obtener el JID
                const userId = await checkWhatsAppNumber(sock, cleanedPhoneNumber);
                if (!userId) {
                    console.log(`Número no registrado en WhatsApp: ${cleanedPhoneNumber}`);
                    return null;
                }

                // Calcular la diferencia horaria
                const timeDifference = getTimeDifferenceFromCountry(country);
                const adjustedTime = addHours(start, timeDifference);

                // Actualizar la hora y día si es necesario
                time = format(adjustedTime, 'HH:mm', { locale: es });
                if (adjustedTime.getDate() !== start.getDate()) {
                    day = format(addDays(start, 1), 'd', { locale: es });
                }

                const eventType = getEventType(summary);
                const dynamicMessagePart = getMessageBasedOnTitle(name, eventType, profileName);

                return {
                    day,
                    weekday,
                    time,
                    description,
                    name,
                    phoneNumber: cleanedPhoneNumber,
                    userId,
                    eventId: event.id,
                    country, // Agregar el país al evento
                    eventType, // Agregar el tipo de evento
                    dynamicMessagePart // Agregar el mensaje dinámico
                };
            } catch (error) {
                console.error('Error procesando la reunión:', event.summary, error);
                return null;
            }
        })).then(events => events.filter(event => event !== null)); // Filtrar reuniones no válidas
    } else {
        return null;
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
    console.log('Authorize this app by visiting this url:', authUrl);
    const { sendAuthUrl } = require('./whatsapp'); // Importa sendAuthUrl aquí
    await sendAuthUrl(authUrl);
    return oAuth2Client;
}

async function getProfileName(auth) {
    const people = google.people({ version: 'v1', auth });
    const res = await people.people.get({
        resourceName: 'people/me',
        personFields: 'names',
    });
    const name = res.data.names && res.data.names.length > 0 ? res.data.names[0].givenName : 'Matias';
    return name;
}

module.exports = { authorize, listEvents, getProfileName, getNewToken, getMessageBasedOnTitle };

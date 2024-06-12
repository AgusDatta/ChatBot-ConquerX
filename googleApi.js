const { google } = require('googleapis');
const fs = require('fs');
const { format, parseISO, addDays, addHours } = require('date-fns');
const { es } = require('date-fns/locale');
const { SCOPES, TOKEN_PATH, credentials } = require('./config');

// Mapeo de prefijos internacionales a países
const countryMapping = {
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
    '598': 'Uruguay',
};

// Mapeo de diferencia horaria por país
const timeDifferences = {
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

function getCountryFromPhoneNumber(phoneNumber) {
    const phonePrefix = phoneNumber.match(/^\+(\d{1,3})9/);
    if (phonePrefix) {
        const countryCode = phonePrefix[1];
        return countryMapping[countryCode] || 'desconocido';
    }
    return 'desconocido';
}

function getTimeDifferenceFromCountry(country) {
    return timeDifferences[country] || 0;
}

// Nueva función para determinar el tipo de evento
function getEventType(summary) {
    if (summary.includes('Formación')) {
        return 'Formación';
    } else if (summary.includes('Desarrollo')) {
        return 'Desarrollo';
    }
    return 'Otro';
}

// Modificar la función listEvents para incluir el tipo de evento
async function listEvents(auth) {
    const calendar = google.calendar({ version: 'v3', auth });
    const res = await calendar.events.list({
        calendarId: 'primary',
        timeMin: (new Date()).toISOString(),
        timeMax: addDays(new Date(), 1).toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
    });
    const events = res.data.items;
    if (events.length) {
        return events.map(event => {
            const start = parseISO(event.start.dateTime || event.start.date);
            let day = format(start, 'd', { locale: es });
            const weekday = format(start, 'EEEE', { locale: es });
            let time = format(start, 'HH:mm', { locale: es });
            const description = event.description || '';
            const summary = event.summary || '';
            const name = summary.split(':')[0].trim();

            // Determinar el tipo de evento
            const eventType = getEventType(summary);

            // Filtrar el número de teléfono
            const phoneMatch = description.match(/Enviar mensajes de texto a: (\+\d[\d\s]+)/);
            const phoneNumber = phoneMatch ? phoneMatch[1].trim().replace(/\s+/g, '') : '';

            // Determinar el país basado en el prefijo, si es posible
            const country = getCountryFromPhoneNumber(phoneNumber);

            // Calcular la diferencia horaria
            const timeDifference = getTimeDifferenceFromCountry(country);
            const adjustedTime = addHours(start, timeDifference);

            // Actualizar la hora y día si es necesario
            time = format(adjustedTime, 'HH:mm', { locale: es });
            if (adjustedTime.getDate() !== start.getDate()) {
                day = format(addDays(start, 1), 'd', { locale: es });
            }

            const userId = `${phoneNumber.replace('+', '')}@s.whatsapp.net`;

            return {
                day,
                weekday,
                time,
                description,
                name,
                phoneNumber,
                userId,
                eventId: event.id,
                country, // Agregar el país al evento
                eventType, // Agregar el tipo de evento
            };
        });
    } else {
        return null;
    }
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

module.exports = { authorize, listEvents, getProfileName, getNewToken };


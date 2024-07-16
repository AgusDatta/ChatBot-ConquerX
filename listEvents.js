const { google } = require('googleapis');
const { format, parseISO, endOfDay, addWeeks } = require('date-fns');
const { es } = require('date-fns/locale');
const moment = require('moment-timezone');
const { checkWhatsAppNumber, getCountryFromDescription, getEventType, getMessageBasedOnTitle, isValidMeeting } = require('./googleApi');
const { getTimezoneFromCountry } = require('./helpers'); // Importar desde helpers

function formatName(name) {
    if (!name) return '';
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

async function listEvents(auth, profileName, sock) {
    const calendar = google.calendar({ version: 'v3', auth });
    const res = await calendar.events.list({
        calendarId: 'primary',
        timeMin: (new Date()).toISOString(), 
        timeMax: endOfDay(addWeeks(new Date(), 1)).toISOString(), 
        singleEvents: true,
        orderBy: 'startTime',
    });
    const events = res.data.items;
    if (events.length) {
        let invalidMeetingsDetails = []; 
        let validEvents = await Promise.all(events.map(async event => {
            
            if (!isValidMeeting(event)) {
                console.log('Reunión no válida, saltando:', event.summary);
                invalidMeetingsDetails.push(event.summary); 
                return null;
            }

            try {
                const start = parseISO(event.start.dateTime || event.start.date);
                const originalDate = new Date(start);
                const description = event.description || '';
                const summary = event.summary || '';
                const name = formatName(summary.split(':')[0].trim());

                const { country, phoneNumber: cleanedPhoneNumber } = getCountryFromDescription(description);

                const { userId, title } = await checkWhatsAppNumber(sock, cleanedPhoneNumber, summary);
                if (!userId) {
                    console.log(`Número no registrado en WhatsApp: ${cleanedPhoneNumber}`);
                    return null;
                }

                const timezone = getTimezoneFromCountry(country);
                const adjustedTime = moment.tz(start, timezone);

                let day = adjustedTime.format('D');
                let weekday = adjustedTime.format('dddd');
                let time = adjustedTime.format('HH:mm');

                console.log(`Hora original: ${format(originalDate, 'HH:mm', { locale: es })}, País del cliente: ${country}, Hora ajustada: ${time}`);

                if (originalDate.getDate() !== adjustedTime.date()) {
                    day = adjustedTime.add(1, 'day').format('D');
                    weekday = adjustedTime.format('dddd');
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
                    country,
                    eventType,
                    dynamicMessagePart,
                    title
                };
            } catch (error) {
                console.error('Error procesando la reunión:', event.summary, error);
                return null;
            }
        })).then(events => events.filter(event => event !== null));
        
        return { validEvents, invalidMeetingsDetails };
    } else {
        return { validEvents: [], invalidMeetingsDetails: [] };
    }
}

module.exports = { listEvents };

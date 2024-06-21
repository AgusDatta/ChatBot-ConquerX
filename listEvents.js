const { google } = require('googleapis');
const { format, parseISO, addHours, endOfDay, addWeeks } = require('date-fns');
const { es } = require('date-fns/locale');
const { checkWhatsAppNumber, getCountryFromDescription, getEventType, getMessageBasedOnTitle, isValidMeeting } = require('./googleApi');
const { getTimeDifferenceFromCountry } = require('./helpers'); // Importar desde helpers

function formatName(name) {
    if (!name) return '';
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
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
        let invalidMeetingsDetails = []; // Inicializar el array para reuniones no válidas
        let validEvents = await Promise.all(events.map(async event => {
            // Validar la reunión antes de procesarla
            if (!isValidMeeting(event)) {
                console.log('Reunión no válida, saltando:', event.summary);
                invalidMeetingsDetails.push(event.summary); // Agregar a reuniones no válidas
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
                const name = formatName(summary.split(':')[0].trim());

                // Obtener el país y el número limpio basado en la descripción del evento
                const { country, phoneNumber: cleanedPhoneNumber } = getCountryFromDescription(description);

                // Verificar si el número está en WhatsApp y obtener el JID
                const { userId, title } = await checkWhatsAppNumber(sock, cleanedPhoneNumber, summary);
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
                    dynamicMessagePart, // Agregar el mensaje dinámico
                    title // Agregar el título del evento
                };
            } catch (error) {
                console.error('Error procesando la reunión:', event.summary, error);
                return null;
            }
        })).then(events => events.filter(event => event !== null)); // Filtrar reuniones no válidas
        
        return { validEvents, invalidMeetingsDetails }; // Devolver eventos válidos y reuniones no válidas
    } else {
        return { validEvents: [], invalidMeetingsDetails: [] };
    }
}

module.exports = { listEvents };

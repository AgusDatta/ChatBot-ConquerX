// helpers.js

const { format, parseISO, addDays, addHours } = require('date-fns');
const { es } = require('date-fns/locale');

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

module.exports = {
    getTimeDifferenceFromCountry,
    getCountryFromDescription,
    getEventType,
    getMessageBasedOnTitle,
    isValidMeeting
};

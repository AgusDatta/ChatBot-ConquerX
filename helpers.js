const { format, parseISO } = require('date-fns');
const { es } = require('date-fns/locale');
const moment = require('moment-timezone');

// Mapeo de prefijos internacionales a países y sus zonas horarias
const countryMapping = {
    '1': 'EEUU',
    '34': 'España',
    '55': 'Brasil',
    '51': 'Peru',
    '52': 'México',
    '53': 'Cuba',
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

// Mapeo de zonas horarias por país
const timezoneMapping = {
    // EEUU
    'EEUU_Eastern': 'America/New_York',
    'EEUU_Central': 'America/Chicago',
    'EEUU_Mountain': 'America/Denver',
    'EEUU_Pacific': 'America/Los_Angeles',
    // México
    'México_Central': 'America/Mexico_City',
    'México_Pacific': 'America/Tijuana',
    'México_Mountain': 'America/Chihuahua'
};

// Mapear subprefijos para EEUU y México
const subPrefixMapping = {
    'EEUU': {
        // Eastern Time Zone
        '201': 'EEUU_Eastern', '202': 'EEUU_Eastern', '203': 'EEUU_Eastern', '205': 'EEUU_Eastern',
        '207': 'EEUU_Eastern', '212': 'EEUU_Eastern', '315': 'EEUU_Eastern', '347': 'EEUU_Eastern',
        // Central Time Zone
        '214': 'EEUU_Central', '312': 'EEUU_Central', '314': 'EEUU_Central', '469': 'EEUU_Central',
        // Mountain Time Zone
        '303': 'EEUU_Mountain', '505': 'EEUU_Mountain', '719': 'EEUU_Mountain', '970': 'EEUU_Mountain',
        // Pacific Time Zone
        '213': 'EEUU_Pacific', '310': 'EEUU_Pacific', '323': 'EEUU_Pacific', '408': 'EEUU_Pacific'
        // Completa más subprefijos según sea necesario
    },
    'México': {
        // Central Time Zone
        '55': 'México_Central', '33': 'México_Central', '81': 'México_Central', '999': 'México_Central',
        // Pacific Time Zone
        '664': 'México_Pacific', '631': 'México_Pacific', '653': 'México_Pacific', '656': 'México_Pacific',
        // Mountain Time Zone
        '614': 'México_Mountain', '341': 'México_Mountain', '461': 'México_Mountain', '639': 'México_Mountain'
        // Completa más subprefijos según sea necesario
    }
};

// Toma la zona horaria por país
function getTimezoneFromCountry(country) {
    return timezoneMapping[country] || 'UTC';
}

// Filtra la descripcion de la reunion para conseguir el numero de telefono
function getCountryFromDescription(description) {
    // Simplificar la expresión regular para capturar ambas variaciones
    const regex = /Enviar mensajes de (?:texto|WhatsApp) a::?\s?(\+\d[\d\s-]+)/;

    // Buscar coincidencias
    const phoneMatch = description.match(regex);

    if (phoneMatch) {
        let phoneNumber = phoneMatch[1];
        console.log('Número encontrado:', phoneNumber);
        const phonePrefix = phoneNumber.match(/^\+(\d{1,3})(\d{1,3})?/);

        if (phonePrefix) {
            const countryCode = phonePrefix[1];
            const subPrefix = phonePrefix[2];
            const country = countryMapping[countryCode] || 'desconocido';
            
            phoneNumber = phoneNumber.replace(/\s+/g, '').replace(/-/g, '');

            if (country === 'EEUU' || country === 'México') {
                const zone = subPrefixMapping[country][subPrefix];
                return { country: zone ? `${country}_${zone}` : country, phoneNumber };
            }

            return { country, phoneNumber };
        }
    }
    console.log('No se encontró ningún número');
    return { country: 'desconocido', phoneNumber: '' };
}

function getEventType(summary) {
    if (summary.includes('Formación en Inversión')) {
        return 'Formación';
    } else if (summary.includes('Desarrollo Full-Stack')) {
        return 'Desarrollo';
    } else if (summary.includes('Ciberseguridad')) {
        return 'Ciberseguridad';
    } else if (summary.includes('Inteligencia Artificial')) {
        return 'Inteligencia';
    }
    return 'Otro';
}

function getMessageBasedOnTitle(name, eventType, profileName) {
    let dynamicMessagePart = '';
    if (eventType === 'Formación') {
        dynamicMessagePart = `Hola ${name} 👋🏻, soy ${profileName} 🙋🏻‍♂️, responsable de admisiones de la *Formación en Inversión de ConquerX*, encantado de conocerte 😊`;
    } else if (eventType === 'Desarrollo') {
        dynamicMessagePart = `Hola ${name} 👋🏻, soy ${profileName} 🙋🏻‍♂️, responsable de admisiones del *Máster en desarrollo Full Stack de Conquer Blocks*, encantado de conocerte 😊`;
    } else if (eventType === 'Ciberseguridad') {
        dynamicMessagePart = `Hola ${name} 👋🏻, soy ${profileName} 🙋🏻‍♂️, responsable de admisiones del *Máster en Ciberseguridad de Conquer Blocks*, encantado de conocerte 😊 `;
    } else if (eventType === 'Inteligencia') {
        dynamicMessagePart = `Hola ${name} 👋🏻, soy ${profileName} 🙋🏻‍♂️, responsable de admisiones del *Máster en Inteligencia Artificial de Conquer Blocks*, encantado de conocerte 😊 `;
    }
    return dynamicMessagePart;
}

function isValidMeeting(meeting) {
    const description = meeting.description || '';
    const title = meeting.summary || '';
    const hasPhoneNumber = description.match(/Enviar mensajes de (?:texto|WhatsApp) a::?\s?(\+\d[\d\s-]+)/);
    const hasValidTitle = title.includes('Formación en Inversión') || title.includes('Desarrollo Full-Stack') || title.includes('Inteligencia Artificial') || title.includes('Ciberseguridad');
    const isNotCancelled = !title.startsWith('Cancelado');

    return hasPhoneNumber && hasValidTitle && isNotCancelled;
}

module.exports = {
    getTimezoneFromCountry,
    getCountryFromDescription,
    getEventType,
    getMessageBasedOnTitle,
    isValidMeeting
};

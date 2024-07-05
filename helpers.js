const { format, parseISO } = require('date-fns');
const { es } = require('date-fns/locale');
const moment = require('moment-timezone');

// Mapeo de prefijos internacionales a países y sus zonas horarias
const countryMapping = {
    '1': 'Canada/EEUU',
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
    'Canada/EEUU': 'America/New_York',
    'España': 'Europe/Madrid',
    'Brasil': 'America/Sao_Paulo',
    'Peru': 'America/Lima',
    'México': 'America/Mexico_City',
    'Cuba': 'America/Havana',
    'Argentina': 'America/Argentina/Buenos_Aires',
    'Chile': 'America/Santiago',
    'Colombia': 'America/Bogota',
    'Venezuela': 'America/Caracas',
    'El Salvador': 'America/El_Salvador',
    'Costa Rica': 'America/Costa_Rica',
    'Panamá': 'America/Panama',
    'Bolivia': 'America/La_Paz',
    'Ecuador': 'America/Guayaquil',
    'Paraguay': 'America/Asuncion',
    'Uruguay': 'America/Montevideo'
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
        const phonePrefix = phoneNumber.match(/^\+(\d{1,3})/);
        
        if (phonePrefix) {
            const countryCode = phonePrefix[1];
            const country = countryMapping[countryCode] || 'desconocido';
            
            phoneNumber = phoneNumber.replace(/\s+/g, '').replace(/-/g, ''); 

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


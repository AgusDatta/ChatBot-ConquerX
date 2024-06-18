const { google } = require('googleapis');

async function getProfileName(auth) {
    const people = google.people({ version: 'v1', auth });
    const res = await people.people.get({
        resourceName: 'people/me',
        personFields: 'names',
    });
    const name = res.data.names && res.data.names.length > 0 ? res.data.names[0].givenName : 'Matias';
    return name;
}

module.exports = { getProfileName };

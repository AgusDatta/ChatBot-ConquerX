const SCOPES = [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/userinfo.profile'
];
const TOKEN_PATH = 'token.json';

const credentials = {
    "installed": {
        "client_id": "864029033316-uu896mrk9s0oa0a49mc3gpbufem4qsam.apps.googleusercontent.com",
        "project_id": "conquerx-bot-installed",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_secret": "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",
        "redirect_uris": ["http://localhost"]
    }
};

module.exports = { SCOPES, TOKEN_PATH, credentials };

const fs = require('fs');
const path = require('path');

const apiUrl = process.env.API_URL || 'https://studyroom-api-qzvh.onrender.com/api';
const signalrUrl = process.env.SIGNALR_URL || 'https://studyroom-api-qzvh.onrender.com/hubs/studyroom';
const googleClientId = process.env.GOOGLE_CLIENT_ID || '328699849312-4hcd0ksoqaacutvotm9ejpigbu329ki6.apps.googleusercontent.com';

const content = `export const environment = {
  production: true,
  apiUrl: '${apiUrl}',
  signalrUrl: '${signalrUrl}',
  googleClientId: '${googleClientId}'
};
`;

fs.writeFileSync(path.join(__dirname, 'src', 'environments', 'environment.prod.ts'), content);
console.log('[OK] Environment file generated');
console.log(`   API_URL: ${apiUrl}`);
console.log(`   SIGNALR_URL: ${signalrUrl}`);

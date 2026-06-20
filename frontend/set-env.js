const fs = require('fs');
const path = require('path');

const apiUrl = process.env.API_URL || 'https://studyroom-api.onrender.com/api';
const signalrUrl = process.env.SIGNALR_URL || 'https://studyroom-api.onrender.com/hubs/studyroom';

const content = `export const environment = {
  production: true,
  apiUrl: '${apiUrl}',
  signalrUrl: '${signalrUrl}'
};
`;

fs.writeFileSync(path.join(__dirname, 'src', 'environments', 'environment.prod.ts'), content);
console.log('✅ Environment file generated');
console.log(`   API_URL: ${apiUrl}`);
console.log(`   SIGNALR_URL: ${signalrUrl}`);

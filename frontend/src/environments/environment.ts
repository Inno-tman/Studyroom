export const environment = {
  production: false,
  apiUrl: '/api',
  signalrUrl: '/hubs/studyroom',
  googleClientId: '328699849312-4hcd0ksoqaacutvotm9ejpigbu329ki6.apps.googleusercontent.com',
  webrtc: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:freeturn.net:3478' },
      { urls: 'turn:freeturn.net:3478?transport=udp', username: 'free', credential: 'free' },
      { urls: 'turn:freeturn.net:3478?transport=tcp', username: 'free', credential: 'free' },
      { urls: 'turns:freeturn.tel:5349?transport=tcp', username: 'free', credential: 'free' }
    ]
  }
};

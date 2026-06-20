module.exports = {
  "/api": {
    "target": "http://localhost:5000",
    "secure": false,
    "logLevel": "debug"
  },
  "/hubs": {
    "target": "http://localhost:5000",
    "ws": true,
    "secure": false,
    "logLevel": "debug"
  }
};

// Mock for isows module
module.exports = {
  WebSocket: global.WebSocket || class MockWebSocket {},
};
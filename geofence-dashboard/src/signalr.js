import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';

let connection = null;

export function startSignalR(onPacket) {
  if (connection) return connection.start();

  connection = new HubConnectionBuilder()
    .withUrl((process.env.REACT_APP_API_URL || 'http://localhost:5077') + '/hub/updates')
    .configureLogging(LogLevel.Information)
    .withAutomaticReconnect()
    .build();

  connection.on('NewPacket', (data) => {
    try {
      onPacket && onPacket(data);
    } catch (e) {
      // ignore handler errors
    }
  });

  return connection.start();
}

export function stopSignalR() {
  if (!connection) return;
  return connection.stop();
}

const signalr = { startSignalR, stopSignalR };
export default signalr;

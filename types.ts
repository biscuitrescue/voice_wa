export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

export interface AudioVisualizerProps {
  isListening: boolean;
  volume: number;
}

export interface Language {
  code: string;
  name: string;
  nativeName: string;
}
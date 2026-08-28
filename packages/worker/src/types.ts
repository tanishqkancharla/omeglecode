export type Env = {
  MATCHMAKER: DurableObjectNamespace;
  ROOMS: DurableObjectNamespace;
};

export type Assignment = {
  room: string;
  session: string;
};

export type SocketData = {
  label: string;
  managed: boolean;
  nickname: string;
  session: string;
  sent: number[];
};

export type RoomStats = {
  joins: number;
  messages: number;
};

export type Stats = {
  joins: number;
  messages: number;
  rooms: Record<string, RoomStats>;
};

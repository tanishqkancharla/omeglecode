export type Env = {
  MATCHMAKER: DurableObjectNamespace;
  ROOMS: DurableObjectNamespace;
};

export type Assignment = {
  room: string;
  session: string;
};

export type SocketData = {
  managed: boolean;
  nickname: string;
  session: string;
  sent: number[];
};

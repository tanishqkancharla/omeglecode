export type Env = {
  MATCHMAKER: DurableObjectNamespace;
  ROOMS: DurableObjectNamespace;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ANALYTICS_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
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

export type CostUsage = {
  invocations: number;
  wallTime: number;
  cpuTime: number;
  incomingWebsocketMessages: number;
  outboundWebsocketMessages: number;
  storedBytes: number;
};

export type CostWindow = {
  since: string;
  until: string;
  usage: CostUsage;
  gbSeconds: number;
  billedRequestUnits: number;
  estimatedUsd: number;
  breakdownUsd: {
    requests: number;
    duration: number;
    storage: number;
  };
};

export type CostUnavailable = {
  available: false;
  reason: string;
};

export type CostAvailable = {
  available: true;
  estimate: true;
  plan: "workers-paid";
  scriptName: string;
  accountTag: string;
  classes: string[];
  units: {
    invocations: string;
    wallTime: string;
    cpuTime: string;
    incomingWebsocketMessages: string;
    outboundWebsocketMessages: string;
    storedBytes: string;
  };
  last24h: CostWindow;
  monthToDate: CostWindow;
};

export type CostResult = CostUnavailable | CostAvailable;

export type LiveData = Stats & {
  updatedAt: string;
  cost: CostResult;
};

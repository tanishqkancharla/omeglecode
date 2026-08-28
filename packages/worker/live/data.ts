export const pollMs = 8_000;

export type RoomStats = {
  joins: number;
  messages: number;
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

export type CostResult =
  | { available: false; reason: string }
  | {
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

export type LiveData = {
  joins: number;
  messages: number;
  rooms: Record<string, RoomStats>;
  updatedAt: string;
  cost: CostResult;
};

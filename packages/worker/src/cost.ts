import { durableObjectClasses, workerScriptName } from "./config.js";
import type {
  CostAvailable,
  CostResult,
  CostUnavailable,
  CostUsage,
  CostWindow,
  Env,
} from "./types.js";

const graphqlUrl = "https://api.cloudflare.com/client/v4/graphql";
const cacheTtlMs = 60_000;
const memoryGb = 0.128;
const paid = {
  requestsIncluded: 1_000_000,
  requestUsdPerMillion: 0.15,
  gbSecondsIncluded: 400_000,
  gbSecondsUsdPerMillion: 12.5,
  storageGbIncluded: 5,
  storageUsdPerGbMonth: 0.2,
  websocketBillingRatio: 20,
} as const;

const units = {
  invocations: "requests (GraphQL durableObjectsInvocationsAdaptiveGroups.sum.requests)",
  wallTime: "microseconds (GraphQL durableObjectsInvocationsAdaptiveGroups.sum.wallTime)",
  cpuTime: "microseconds (GraphQL durableObjectsPeriodicGroups.sum.cpuTime)",
  incomingWebsocketMessages:
    "messages (GraphQL durableObjectsPeriodicGroups.sum.incomingWebsocketMsgCount)",
  outboundWebsocketMessages:
    "messages (GraphQL durableObjectsPeriodicGroups.sum.outboundWebsocketMsgCount)",
  storedBytes: "bytes (GraphQL durableObjectsStorageGroups.max.storedBytes)",
} as const;

type GraphqlResponse<T> = {
  data?: T;
  errors?: { message?: string }[];
};

type AccountViewer = {
  viewer?: { accounts?: { accountTag?: string }[] };
};

type UsageViewer = {
  viewer?: {
    accounts?: {
      durableObjectsInvocationsAdaptiveGroups?: {
        sum?: { requests?: number; wallTime?: number };
      }[];
      durableObjectsPeriodicGroups?: {
        sum?: {
          cpuTime?: number;
          incomingWebsocketMsgCount?: number;
          outboundWebsocketMsgCount?: number;
        };
      }[];
      durableObjectsStorageGroups?: { max?: { storedBytes?: number } }[];
    }[];
  };
};

const usageQuery = `
query DurableObjectUsage($accountTag: string, $scriptName: string, $start: string, $end: string) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      durableObjectsInvocationsAdaptiveGroups(
        filter: { scriptName: $scriptName, datetime_geq: $start, datetime_leq: $end }
        limit: 10000
      ) {
        sum { requests wallTime }
      }
      durableObjectsPeriodicGroups(
        filter: { scriptName: $scriptName, datetime_geq: $start, datetime_leq: $end }
        limit: 10000
      ) {
        sum { cpuTime incomingWebsocketMsgCount outboundWebsocketMsgCount }
      }
      durableObjectsStorageGroups(
        filter: { scriptName: $scriptName, datetime_geq: $start, datetime_leq: $end }
        limit: 10000
      ) {
        max { storedBytes }
      }
    }
  }
}
`;

const usageQueryWithoutWebsocket = `
query DurableObjectUsage($accountTag: string, $scriptName: string, $start: string, $end: string) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      durableObjectsInvocationsAdaptiveGroups(
        filter: { scriptName: $scriptName, datetime_geq: $start, datetime_leq: $end }
        limit: 10000
      ) {
        sum { requests wallTime }
      }
      durableObjectsPeriodicGroups(
        filter: { scriptName: $scriptName, datetime_geq: $start, datetime_leq: $end }
        limit: 10000
      ) {
        sum { cpuTime }
      }
      durableObjectsStorageGroups(
        filter: { scriptName: $scriptName, datetime_geq: $start, datetime_leq: $end }
        limit: 10000
      ) {
        max { storedBytes }
      }
    }
  }
}
`;

export function analyticsToken(env: Env): string | undefined {
  const token = env.CLOUDFLARE_ANALYTICS_TOKEN ?? env.CLOUDFLARE_API_TOKEN;
  return token && token.length > 0 ? token : undefined;
}

export function emptyUsage(): CostUsage {
  return {
    invocations: 0,
    wallTime: 0,
    cpuTime: 0,
    incomingWebsocketMessages: 0,
    outboundWebsocketMessages: 0,
    storedBytes: 0,
  };
}

export function sumUsage(groups: CostUsage[]): CostUsage {
  return groups.reduce(
    (total, part) => ({
      invocations: total.invocations + part.invocations,
      wallTime: total.wallTime + part.wallTime,
      cpuTime: total.cpuTime + part.cpuTime,
      incomingWebsocketMessages:
        total.incomingWebsocketMessages + part.incomingWebsocketMessages,
      outboundWebsocketMessages:
        total.outboundWebsocketMessages + part.outboundWebsocketMessages,
      storedBytes: Math.max(total.storedBytes, part.storedBytes),
    }),
    emptyUsage(),
  );
}

export function billedRequestUnits(usage: CostUsage): number {
  return (
    usage.invocations +
    usage.incomingWebsocketMessages / paid.websocketBillingRatio
  );
}

export function gbSecondsFromWallTime(wallTimeMicroseconds: number): number {
  return (wallTimeMicroseconds / 1_000_000) * memoryGb;
}

function roundUpToMillion(value: number): number {
  if (value <= 0) return 0;
  return Math.ceil(value / 1_000_000) * 1_000_000;
}

export function estimateUsd(
  usage: CostUsage,
  applyMonthlyIncluded: boolean,
): CostWindow["breakdownUsd"] & { total: number } {
  const requests = billedRequestUnits(usage);
  const duration = gbSecondsFromWallTime(usage.wallTime);
  const storageGb = usage.storedBytes / 1_000_000_000;
  const billableRequests = applyMonthlyIncluded
    ? Math.max(0, requests - paid.requestsIncluded)
    : requests;
  const billableDuration = applyMonthlyIncluded
    ? Math.max(0, duration - paid.gbSecondsIncluded)
    : duration;
  const billableStorage = applyMonthlyIncluded
    ? Math.max(0, storageGb - paid.storageGbIncluded)
    : storageGb;
  const requestUnits = applyMonthlyIncluded
    ? roundUpToMillion(billableRequests)
    : billableRequests;
  const durationUnits = applyMonthlyIncluded
    ? roundUpToMillion(billableDuration)
    : billableDuration;
  const requestsUsd = (requestUnits / 1_000_000) * paid.requestUsdPerMillion;
  const durationUsd = (durationUnits / 1_000_000) * paid.gbSecondsUsdPerMillion;
  const storageUsd = billableStorage * paid.storageUsdPerGbMonth;
  return {
    requests: requestsUsd,
    duration: durationUsd,
    storage: storageUsd,
    total: requestsUsd + durationUsd + storageUsd,
  };
}

export function costWindow(
  usage: CostUsage,
  since: Date,
  until: Date,
  applyMonthlyIncluded: boolean,
): CostWindow {
  const breakdown = estimateUsd(usage, applyMonthlyIncluded);
  return {
    since: since.toISOString(),
    until: until.toISOString(),
    usage,
    gbSeconds: gbSecondsFromWallTime(usage.wallTime),
    billedRequestUnits: billedRequestUnits(usage),
    estimatedUsd: breakdown.total,
    breakdownUsd: {
      requests: breakdown.requests,
      duration: breakdown.duration,
      storage: breakdown.storage,
    },
  };
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function usageFromGraphql(data: UsageViewer | undefined): CostUsage {
  const account = data?.viewer?.accounts?.[0];
  const invocations = (account?.durableObjectsInvocationsAdaptiveGroups ?? []).map(
    (group) => ({
      invocations: asNumber(group.sum?.requests),
      wallTime: asNumber(group.sum?.wallTime),
      cpuTime: 0,
      incomingWebsocketMessages: 0,
      outboundWebsocketMessages: 0,
      storedBytes: 0,
    }),
  );
  const periodic = (account?.durableObjectsPeriodicGroups ?? []).map((group) => ({
    invocations: 0,
    wallTime: 0,
    cpuTime: asNumber(group.sum?.cpuTime),
    incomingWebsocketMessages: asNumber(group.sum?.incomingWebsocketMsgCount),
    outboundWebsocketMessages: asNumber(group.sum?.outboundWebsocketMsgCount),
    storedBytes: 0,
  }));
  const storage = (account?.durableObjectsStorageGroups ?? []).map((group) => ({
    invocations: 0,
    wallTime: 0,
    cpuTime: 0,
    incomingWebsocketMessages: 0,
    outboundWebsocketMessages: 0,
    storedBytes: asNumber(group.max?.storedBytes),
  }));
  return sumUsage([...invocations, ...periodic, ...storage]);
}

function graphqlErrors(errors: { message?: string }[] | undefined): string {
  return (errors ?? [])
    .map((error) => error.message)
    .filter((message): message is string => Boolean(message))
    .join("; ");
}

function unknownWebsocketFields(message: string): boolean {
  return /incomingWebsocketMsgCount|outboundWebsocketMsgCount/.test(message);
}

async function graphql<T>(
  token: string,
  query: string,
  variables: Record<string, string>,
): Promise<GraphqlResponse<T>> {
  const response = await fetch(graphqlUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await response.json()) as GraphqlResponse<T> & {
    error?: string;
    errors?: { message?: string }[];
    messages?: { message?: string }[];
  };
  if (!response.ok) {
    const detail =
      graphqlErrors(body.errors) ||
      body.error ||
      graphqlErrors(body.messages) ||
      `GraphQL HTTP ${response.status}`;
    return { errors: [{ message: detail }] };
  }
  return body;
}

async function resolveAccountTag(
  env: Env,
  token: string,
): Promise<string | CostUnavailable> {
  const configured = env.CLOUDFLARE_ACCOUNT_ID?.trim();
  if (configured) return configured;
  const result = await graphql<AccountViewer>(
    token,
    "query { viewer { accounts { accountTag } } }",
    {},
  );
  if (result.errors?.length)
    return {
      available: false,
      reason: `Cloudflare analytics could not list accounts: ${graphqlErrors(result.errors)}`,
    };
  const tags = (result.data?.viewer?.accounts ?? [])
    .map((account) => account.accountTag)
    .filter((tag): tag is string => Boolean(tag));
  if (tags.length === 1) return tags[0]!;
  if (tags.length === 0)
    return {
      available: false,
      reason:
        "Cloudflare analytics token has no accounts. Set CLOUDFLARE_ACCOUNT_ID or use a token with Account Analytics read.",
    };
  return {
    available: false,
    reason:
      "Cloudflare analytics token can see multiple accounts. Set CLOUDFLARE_ACCOUNT_ID to the account that owns the omeglecode worker.",
  };
}

async function fetchUsage(
  token: string,
  accountTag: string,
  start: Date,
  end: Date,
): Promise<CostUsage | CostUnavailable> {
  const variables = {
    accountTag,
    scriptName: workerScriptName,
    start: start.toISOString(),
    end: end.toISOString(),
  };
  let result = await graphql<UsageViewer>(token, usageQuery, variables);
  const message = graphqlErrors(result.errors);
  if (message && unknownWebsocketFields(message)) {
    result = await graphql<UsageViewer>(
      token,
      usageQueryWithoutWebsocket,
      variables,
    );
  }
  if (result.errors?.length)
    return {
      available: false,
      reason: `Cloudflare analytics query failed: ${graphqlErrors(result.errors)}`,
    };
  return usageFromGraphql(result.data);
}

export async function durableObjectCost(env: Env): Promise<CostResult> {
  const token = analyticsToken(env);
  if (!token)
    return {
      available: false,
      reason:
        "Durable Object cost needs a Worker secret named CLOUDFLARE_API_TOKEN or CLOUDFLARE_ANALYTICS_TOKEN with Account Analytics read.",
    };

  const accountTag = await resolveAccountTag(env, token);
  if (typeof accountTag !== "string") return accountTag;

  const until = new Date();
  const last24hStart = new Date(until.getTime() - 24 * 60 * 60 * 1000);
  const monthStart = new Date(
    Date.UTC(until.getUTCFullYear(), until.getUTCMonth(), 1),
  );

  const [last24hUsage, monthUsage] = await Promise.all([
    fetchUsage(token, accountTag, last24hStart, until),
    fetchUsage(token, accountTag, monthStart, until),
  ]);
  if ("available" in last24hUsage) return last24hUsage;
  if ("available" in monthUsage) return monthUsage;

  return {
    available: true,
    estimate: true,
    plan: "workers-paid",
    scriptName: workerScriptName,
    accountTag,
    classes: [...durableObjectClasses],
    units,
    last24h: costWindow(last24hUsage, last24hStart, until, false),
    monthToDate: costWindow(monthUsage, monthStart, until, true),
  } satisfies CostAvailable;
}

export async function cachedDurableObjectCost(env: Env): Promise<CostResult> {
  const token = analyticsToken(env);
  if (!token) return durableObjectCost(env);

  const key = new Request("https://omeglecode.local/live/cost-cache");
  const cache = caches.default;
  const cached = await cache.match(key);
  if (cached) {
    try {
      return await cached.json<CostResult>();
    } catch {
      // Rebuild below.
    }
  }

  const cost = await durableObjectCost(env);
  const response = new Response(JSON.stringify(cost), {
    headers: {
      "content-type": "application/json",
      "cache-control": `max-age=${Math.floor(cacheTtlMs / 1000)}`,
    },
  });
  await cache.put(key, response.clone());
  return cost;
}

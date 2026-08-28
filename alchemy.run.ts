import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";

export const MatchmakerNamespace = Cloudflare.DurableObject("Matchmaker", {
  className: "Matchmaker",
});

export const RoomNamespace = Cloudflare.DurableObject("ChatRoom", {
  className: "ChatRoom",
});

export const OmeglecodeWorker = Cloudflare.Worker("OmeglecodeWorker", {
  name: "omeglecode",
  main: "./packages/worker/src/index.ts",
  compatibility: { date: "2026-08-22" },
  workersDev: true,
  env: {
    MATCHMAKER: MatchmakerNamespace,
    ROOMS: RoomNamespace,
    CLOUDFLARE_API_TOKEN: Config.redacted("CLOUDFLARE_ANALYTICS_TOKEN").pipe(
      Config.orElse(() => Config.redacted("CLOUDFLARE_API_TOKEN")),
      Config.withDefault(Redacted.make("")),
    ),
    CLOUDFLARE_ACCOUNT_ID: Config.string("CLOUDFLARE_ACCOUNT_ID").pipe(
      Config.withDefault(""),
    ),
  },
});

export default Alchemy.Stack(
  "Omeglecode",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const worker = yield* OmeglecodeWorker;
    return { url: worker.url };
  }),
);

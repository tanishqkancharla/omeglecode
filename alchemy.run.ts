import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";

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

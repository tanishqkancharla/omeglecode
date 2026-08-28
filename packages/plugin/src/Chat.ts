import type { Plugin } from "@opencode-ai/plugin/tui";
import { createChat as createSharedChat, type Chat } from "@omeglecode/client";

export type { Chat };

export function createChat(context: Plugin.Context, endpoint: string): Chat {
  return createSharedChat({
    endpoint,
    onChange: () => context.renderer.requestRender(),
    onError: (message) => {
      context.ui.toast.show({
        variant: "warning",
        message,
      });
    },
  });
}

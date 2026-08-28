declare module "@earendil-works/pi-coding-agent" {
  export type Theme = {
    fg(name: string, text: string): string;
  };

  export type ExtensionUIContext = {
    select(
      title: string,
      options: string[],
    ): Promise<string | undefined>;
    confirm(title: string, message: string): Promise<boolean>;
    input(
      title: string,
      placeholder?: string,
    ): Promise<string | undefined>;
    notify(message: string, type?: "info" | "warning" | "error"): void;
    setWidget(
      key: string,
      content:
        | string[]
        | ((
            tui: import("@earendil-works/pi-tui").TUI,
            theme: Theme,
          ) => import("@earendil-works/pi-tui").Component)
        | undefined,
      options?: { placement?: "aboveEditor" | "belowEditor" },
    ): void;
    custom<T>(
      factory: (
        tui: import("@earendil-works/pi-tui").TUI,
        theme: Theme,
        keybindings: unknown,
        done: (result: T) => void,
      ) => import("@earendil-works/pi-tui").Component,
      options?: {
        overlay?: boolean;
        overlayOptions?: Record<string, unknown> | (() => Record<string, unknown>);
      },
    ): Promise<T>;
  };

  export type ExtensionContext = {
    ui: ExtensionUIContext;
    hasUI: boolean;
    cwd: string;
    sessionManager: {
      getSessionFile(): string | undefined;
    };
  };

  export type ExtensionAPI = {
    on(
      event: "session_start" | "session_shutdown",
      handler: (event: unknown, ctx: ExtensionContext) => void | Promise<void>,
    ): void;
    registerCommand(
      name: string,
      options: {
        description?: string;
        handler: (
          args: string,
          ctx: ExtensionContext,
        ) => void | Promise<void>;
        getArgumentCompletions?: (
          prefix: string,
        ) => { value: string; label: string }[] | null;
      },
    ): void;
    registerShortcut(
      shortcut: string,
      options: {
        description?: string;
        handler: (ctx: ExtensionContext) => void | Promise<void>;
      },
    ): void;
  };
}

declare module "@earendil-works/pi-tui" {
  export type Component = {
    render(width: number): string[];
    handleInput?(data: string): void;
    invalidate(): void;
    dispose?(): void;
  };

  export type TUI = {
    requestRender(): void;
    terminal: { rows: number; cols: number };
  };

  export function matchesKey(data: string, key: string): boolean;
  export function truncateToWidth(
    text: string,
    width: number,
    ellipsis?: string,
    pad?: boolean,
  ): string;
  export function visibleWidth(text: string): number;
  export function decodeKittyPrintable(data: string): string | undefined;
}

declare module "@earendil-works/pi-coding-agent" {
  export type Theme = {
    fg(name: string, text: string): string;
  };

  export type InputEvent = {
    type: "input";
    text: string;
    images?: unknown[];
    source: "interactive" | "rpc" | "extension";
  };

  export type InputEventResult =
    | { action: "continue" }
    | { action: "transform"; text: string; images?: unknown[] }
    | { action: "handled" };

  export class CustomEditor {
    constructor(
      tui: import("@earendil-works/pi-tui").TUI,
      theme: Theme,
      keybindings: unknown,
      options?: unknown,
    );
    handleInput(data: string): void;
    render(width: number): string[];
    invalidate(): void;
    dispose?(): void;
  }

  export type ExtensionUIContext = {
    theme: Theme;
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
    setStatus(key: string, text: string | undefined): void;
    onTerminalInput(
      handler: (data: string) => { consume?: boolean; data?: string } | undefined,
    ): () => void;
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
    setEditorComponent(
      factory:
        | ((
            tui: import("@earendil-works/pi-tui").TUI,
            theme: Theme,
            keybindings: unknown,
          ) => import("@earendil-works/pi-tui").Component)
        | undefined,
    ): void;
    getEditorComponent():
      | ((
          tui: import("@earendil-works/pi-tui").TUI,
          theme: Theme,
          keybindings: unknown,
        ) => import("@earendil-works/pi-tui").Component)
      | undefined;
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
    on(
      event: "input",
      handler: (
        event: InputEvent,
        ctx: ExtensionContext,
      ) => void | Promise<void> | InputEventResult | Promise<InputEventResult>,
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

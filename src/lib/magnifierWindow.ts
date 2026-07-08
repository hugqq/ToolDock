export const MAGNIFIER_WINDOW_LABEL = "magnifier";

export const MAGNIFIER_WINDOW_OPTIONS = {
  url: "index.html#/magnifier",
  title: "Magnifier",
  maximized: true,
  decorations: false,
  transparent: true,
  alwaysOnTop: true,
  skipTaskbar: true,
  visible: false,
  resizable: false,
  shadow: false,
};

type TauriWindowEvent = "tauri://created" | "tauri://error";

type WindowWithCreationEvents = {
  once: (
    eventName: TauriWindowEvent,
    handler: (event: { payload?: unknown }) => void
  ) => Promise<() => void>;
};

export const waitForWindowCreated = <T extends WindowWithCreationEvents>(
  window: T
): Promise<T> =>
  new Promise((resolve, reject) => {
    let settled = false;
    let unlistenCreated: (() => void) | undefined;
    let unlistenError: (() => void) | undefined;

    const cleanup = () => {
      unlistenCreated?.();
      unlistenError?.();
    };

    const settle = (finish: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      finish();
    };

    window
      .once("tauri://created", () => settle(() => resolve(window)))
      .then((unlisten) => {
        unlistenCreated = unlisten;
        if (settled) unlisten();
      })
      .catch((error) => settle(() => reject(error)));

    window
      .once("tauri://error", (event) =>
        settle(() =>
          reject(event.payload ?? new Error("Failed to create magnifier window"))
        )
      )
      .then((unlisten) => {
        unlistenError = unlisten;
        if (settled) unlisten();
      })
      .catch((error) => settle(() => reject(error)));
  });

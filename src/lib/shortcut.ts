export interface ShortcutKeyInput {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
}

const MODIFIER_KEYS = ["Control", "Shift", "Alt", "Meta"];

export const buildShortcutFromKey = (
  input: ShortcutKeyInput
): string | null => {
  if (MODIFIER_KEYS.includes(input.key)) return null;

  const modifiers: string[] = [];
  if (input.ctrlKey) modifiers.push("Ctrl");
  if (input.shiftKey) modifiers.push("Shift");
  if (input.altKey) modifiers.push("Alt");
  if (input.metaKey) modifiers.push("Meta");

  const key =
    input.code === "Space" || input.key === " "
      ? "Space"
      : input.key.length === 1
        ? input.key.toUpperCase()
        : input.key;

  return [...modifiers, key].join("+");
};

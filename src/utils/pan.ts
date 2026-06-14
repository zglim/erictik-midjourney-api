import { MJOptions } from "../interfaces";

/**
 * Pan directions supported by Midjourney's pan buttons (remix off).
 */
export type PanDirection = "left" | "right" | "up" | "down";

/**
 * Map each pan direction to the Discord button emoji label that
 * Midjourney renders on an upscaled message.
 */
export const PanLabels: Record<PanDirection, string> = {
  left: "⬅️",
  right: "➡️",
  up: "⬆️",
  down: "⬇️",
};

/**
 * Resolve the button label for a pan direction, throwing a clear error
 * when an unsupported direction is passed.
 */
export const panLabel = (direction: PanDirection): string => {
  const label = PanLabels[direction];
  if (!label) {
    throw new Error(
      `invalid pan direction "${direction}", expected one of ${Object.keys(
        PanLabels
      ).join(", ")}`
    );
  }
  return label;
};

/**
 * Build the prompt content Midjourney expects for a pan action,
 * e.g. `panContent("a cat", "right", 2)` => `"a cat --pan_right 2"`.
 */
export const panContent = (
  prompt: string,
  direction: PanDirection,
  amount = 2
): string => {
  panLabel(direction); // validate direction before composing content
  return `${prompt} --pan_${direction} ${amount}`.trim();
};

/**
 * Locate a button option by its label, throwing a clear error when the
 * option is missing. Shared by every "press a button found by label" action.
 */
export const findOptionByLabel = (
  options: MJOptions[] | undefined,
  label: string
): MJOptions => {
  const option = options?.find((o) => o.label === label);
  if (!option) {
    throw new Error(`option "${label}" not found`);
  }
  return option;
};

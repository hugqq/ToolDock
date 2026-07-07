export type CronFieldType =
  | "seconds"
  | "minutes"
  | "hours"
  | "days"
  | "months"
  | "weeks";

export interface CronFieldState {
  type: "any" | "range" | "step" | "specific";
  rangeStart: number;
  rangeEnd: number;
  stepStart: number;
  stepValue: number;
  specificValues: number[];
}

export const DEFAULT_CRON_FIELD_STATE: CronFieldState = {
  type: "any",
  rangeStart: 0,
  rangeEnd: 59,
  stepStart: 0,
  stepValue: 1,
  specificValues: [],
};

export const CRON_FIELD_CONFIGS: Record<
  CronFieldType,
  { min: number; max: number; label: string }
> = {
  seconds: { min: 0, max: 59, label: "秒" },
  minutes: { min: 0, max: 59, label: "分" },
  hours: { min: 0, max: 23, label: "时" },
  days: { min: 1, max: 31, label: "日" },
  months: { min: 1, max: 12, label: "月" },
  weeks: { min: 0, max: 6, label: "周" },
};

export const getCronTabs = (includeSeconds: boolean): CronFieldType[] =>
  includeSeconds
    ? ["seconds", "minutes", "hours", "days", "months", "weeks"]
    : ["minutes", "hours", "days", "months", "weeks"];

export const createDefaultCronFieldStates = (): Record<
  CronFieldType,
  CronFieldState
> => ({
  seconds: { ...DEFAULT_CRON_FIELD_STATE, type: "specific", specificValues: [0] },
  minutes: { ...DEFAULT_CRON_FIELD_STATE },
  hours: { ...DEFAULT_CRON_FIELD_STATE },
  days: {
    ...DEFAULT_CRON_FIELD_STATE,
    rangeStart: 1,
    rangeEnd: 31,
    stepStart: 1,
  },
  months: {
    ...DEFAULT_CRON_FIELD_STATE,
    rangeStart: 1,
    rangeEnd: 12,
    stepStart: 1,
  },
  weeks: { ...DEFAULT_CRON_FIELD_STATE, type: "any" },
});

const formatField = (
  field: CronFieldType,
  states: Record<CronFieldType, CronFieldState>
) => {
  const state = states[field];

  if (field === "days" && states.weeks.type !== "any") {
    return "?";
  }
  if (field === "weeks" && states.days.type !== "any") {
    return "?";
  }
  if (field === "weeks" && states.days.type === "any" && state.type === "any") {
    return "?";
  }

  switch (state.type) {
    case "any":
      return "*";
    case "range":
      return `${state.rangeStart}-${state.rangeEnd}`;
    case "step":
      return `${state.stepStart}/${state.stepValue}`;
    case "specific":
      return state.specificValues.length > 0
        ? [...state.specificValues].sort((a, b) => a - b).join(",")
        : "*";
    default:
      return "*";
  }
};

export const buildCronExpression = (
  states: Record<CronFieldType, CronFieldState>,
  includeSeconds: boolean
) => getCronTabs(includeSeconds).map((field) => formatField(field, states)).join(" ");

const parseFieldPart = (field: CronFieldType, part: string): CronFieldState => {
  const config = CRON_FIELD_CONFIGS[field];
  const state: CronFieldState = {
    ...DEFAULT_CRON_FIELD_STATE,
    rangeStart: config.min,
    rangeEnd: config.max,
    stepStart: config.min,
    stepValue: 1,
  };

  if (part === "*" || part === "?") {
    state.type = "any";
  } else if (part.includes("-")) {
    const [start, end] = part.split("-").map(Number);
    state.type = "range";
    state.rangeStart = Math.max(
      config.min,
      Math.min(config.max, Number.isNaN(start) ? config.min : start)
    );
    state.rangeEnd = Math.max(
      config.min,
      Math.min(config.max, Number.isNaN(end) ? config.max : end)
    );
  } else if (part.includes("/")) {
    const [start, step] = part.split("/").map(Number);
    state.type = "step";
    state.stepStart = Math.max(
      config.min,
      Math.min(config.max, Number.isNaN(start) ? config.min : start)
    );
    state.stepValue = Math.max(
      1,
      Math.min(config.max, Number.isNaN(step) ? 1 : step)
    );
  } else if (part.includes(",")) {
    state.type = "specific";
    state.specificValues = part
      .split(",")
      .map(Number)
      .filter((value) => !Number.isNaN(value))
      .map((value) => Math.max(config.min, Math.min(config.max, value)));
  } else if (!Number.isNaN(Number(part))) {
    state.type = "specific";
    state.specificValues = [
      Math.max(config.min, Math.min(config.max, Number(part))),
    ];
  } else {
    state.type = "any";
  }

  return state;
};

export const parseCronExpression = (
  expression: string
): { includeSeconds: boolean; states: Record<CronFieldType, CronFieldState> } | null => {
  const parts = expression.trim().split(/\s+/).filter(Boolean);

  if (parts.length !== 5 && parts.length !== 6) {
    return null;
  }

  const includeSeconds = parts.length === 6;
  const states = createDefaultCronFieldStates();
  const tabs = getCronTabs(includeSeconds);

  tabs.forEach((field, index) => {
    states[field] = parseFieldPart(field, parts[index]);
  });

  return { includeSeconds, states };
};

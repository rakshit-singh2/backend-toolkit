import type { LogLevel, LogMeta } from "./types.js";

const COLORS = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    gray: "\x1b[90m",
} as const;

export const getTime = (): string => new Date().toISOString();

export const safeStringify = (obj: unknown): string => {
    try {
        return JSON.stringify(obj);
    } catch {
        return "[Unserializable Object]";
    }
};

export const formatMeta = (meta?: LogMeta): string => {
    if (!meta) return "";

    if (meta instanceof Error) {
        return ` | message="${meta.message}" stack="${meta.stack}"`;
    }

    if (typeof meta === "object") {
        return ` | ${safeStringify(meta)}`;
    }

    return ` | ${String(meta)}`;
};

export const colorize = (level: LogLevel, text: string): string => {
    switch (level) {
        case "ERROR":
            return `${COLORS.red}${text}${COLORS.reset}`;
        case "WARN":
            return `${COLORS.yellow}${text}${COLORS.reset}`;
        case "INFO":
            return `${COLORS.blue}${text}${COLORS.reset}`;
        case "DEBUG":
            return `${COLORS.gray}${text}${COLORS.reset}`;
        case "SUCCESS":
            return `${COLORS.green}${text}${COLORS.reset}`;
        default:
            return text;
    }
};

export const formatMessage = (
    level: LogLevel,
    message: unknown,
    meta?: LogMeta
): string => {
    const normalized =
        typeof message === "object"
            ? safeStringify(message)
            : String(message);

    const base = `[${level}] [${getTime()}] ${normalized}${formatMeta(meta)}`;

    return colorize(level, base);
};
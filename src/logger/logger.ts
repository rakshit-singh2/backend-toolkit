import type { Logger, LogMeta, LogLevel } from "./types.js";
import { formatMessage } from "./utils.js";

function createBaseLogger(context: Record<string, any> = {}): Logger {
    const log = (level: LogLevel, message: unknown, meta?: LogMeta) => {
        const finalMeta =
            context && Object.keys(context).length
                ? { ...context, ...(meta as object) }
                : meta;

        const formatted = formatMessage(level, message, finalMeta);

        switch (level) {
            case "ERROR":
                console.error(formatted);
                break;
            case "WARN":
                console.warn(formatted);
                break;
            case "DEBUG":
                console.debug(formatted);
                break;
            case "SUCCESS":
            case "INFO":
            default:
                console.log(formatted);
        }
    };

    const logger: Logger = {
        info: (msg, meta) => log("INFO", msg, meta),
        success: (msg, meta) => log("SUCCESS", msg, meta),
        warn: (msg, meta) => log("WARN", msg, meta),
        error: (msg, meta) => log("ERROR", msg, meta),
        debug: (msg, meta) => log("DEBUG", msg, meta),

        child: (childContext = {}) => {
            return createBaseLogger({
                ...context,
                ...childContext,
            });
        },
    };

    return logger;
}

export const logger = createBaseLogger();
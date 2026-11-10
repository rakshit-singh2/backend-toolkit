export type LogLevel = "INFO" | "SUCCESS" | "WARN" | "ERROR" | "DEBUG";

export type LogMeta = Record<string, any> | Error | unknown;

export interface Logger {
    info(message: unknown, meta?: LogMeta): void;
    success(message: unknown, meta?: LogMeta): void;
    warn(message: unknown, meta?: LogMeta): void;
    error(message: unknown, meta?: LogMeta): void;
    debug(message: unknown, meta?: LogMeta): void;

    child(context?: Record<string, any>): Logger;
}
export interface LoggerConfig {
    isProd?: boolean;
}
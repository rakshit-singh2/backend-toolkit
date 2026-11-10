export interface MonitorConfig {
    nodeEnv: string;
    isProduction: boolean;
    socketMonitorEnabled: boolean;
    socketSlowEventThresholdMs: number;
    redisMonitorEnabled: boolean;
    redisSlowCommandThresholdMs: number;
    performanceMonitorEnabled: boolean;
    performanceMonitorIntervalMs: number;
    requestMonitorEnabled: boolean;
    graphqlMonitorEnabled: boolean;
    defaultServiceName?: string;
}

const DEFAULT_CONFIG: MonitorConfig = {
    nodeEnv: "development",
    isProduction: false,
    socketMonitorEnabled: true,
    socketSlowEventThresholdMs: 50,
    redisMonitorEnabled: true,
    redisSlowCommandThresholdMs: 20,
    performanceMonitorEnabled: true,
    performanceMonitorIntervalMs: 5000,
    requestMonitorEnabled: true,
    graphqlMonitorEnabled: true,
    defaultServiceName: undefined,
};

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
    if (typeof value !== "string") {
        return fallback;
    }

    const normalized = value.trim().toLowerCase();
    if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
        return true;
    }

    if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
        return false;
    }

    return fallback;
}

function parseNumber(value: string | undefined, fallback: number): number {
    if (typeof value !== "string") {
        return fallback;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getMonitorConfig(): MonitorConfig {
    const env = typeof process !== "undefined" ? process.env : undefined;

    if (!env) {
        return DEFAULT_CONFIG;
    }

    const nodeEnv = env.NODE_ENV ?? DEFAULT_CONFIG.nodeEnv;

    return {
        nodeEnv,
        isProduction: nodeEnv === "production",
        socketMonitorEnabled: parseBoolean(env.TOOLKIT_SOCKET_MONITOR, DEFAULT_CONFIG.socketMonitorEnabled),
        socketSlowEventThresholdMs: parseNumber(
            env.TOOLKIT_SOCKET_SLOW_EVENT_MS,
            DEFAULT_CONFIG.socketSlowEventThresholdMs,
        ),
        redisMonitorEnabled: parseBoolean(env.TOOLKIT_REDIS_MONITOR, DEFAULT_CONFIG.redisMonitorEnabled),
        redisSlowCommandThresholdMs: parseNumber(
            env.TOOLKIT_REDIS_SLOW_COMMAND_MS,
            DEFAULT_CONFIG.redisSlowCommandThresholdMs,
        ),
        performanceMonitorEnabled: parseBoolean(
            env.TOOLKIT_PERFORMANCE_MONITOR,
            DEFAULT_CONFIG.performanceMonitorEnabled,
        ),
        performanceMonitorIntervalMs: parseNumber(
            env.TOOLKIT_MONITOR_INTERVAL,
            DEFAULT_CONFIG.performanceMonitorIntervalMs,
        ),
        requestMonitorEnabled: parseBoolean(env.TOOLKIT_REQUEST_MONITOR, DEFAULT_CONFIG.requestMonitorEnabled),
        graphqlMonitorEnabled: parseBoolean(env.TOOLKIT_GRAPHQL_MONITOR, DEFAULT_CONFIG.graphqlMonitorEnabled),
        defaultServiceName: env.TOOLKIT_SERVICE_NAME || DEFAULT_CONFIG.defaultServiceName,
    };
}

export const monitorConfigDefaults = DEFAULT_CONFIG;

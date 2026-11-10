import { getMonitorConfig } from "../config/index.js";
import { logger as baseLogger } from "../logger/index.js";
import type { RedisMetrics, RedisMonitorHandle, RedisMonitorOptions } from "./types.js";

function getLogger() {
    return baseLogger.child({ component: "redis" });
}

function normalizeOptions(options?: RedisMonitorOptions): Required<RedisMonitorOptions> {
    const config = getMonitorConfig();
    return {
        slowCommandThreshold: options?.slowCommandThreshold ?? config.redisSlowCommandThresholdMs,
        ignoredCommands: options?.ignoredCommands ?? [],
        loggerEnabled: options?.loggerEnabled ?? true,
    };
}

function createMetrics(): RedisMetrics {
    return {
        connect: 0,
        ready: 0,
        reconnecting: 0,
        disconnect: 0,
        errors: 0,
        commandsExecuted: 0,
        failedCommands: 0,
        pipelineCount: 0,
        pubSubMessages: 0,
        averageLatencyMs: 0,
        slowCommands: 0,
        bytesSent: 0,
        bytesReceived: 0,
        lastCommandAt: undefined,
        lastErrorAt: undefined,
    };
}

/**
 * Wraps a node-redis client and collects command, connection, and latency metrics.
 */
export function monitorRedis<T extends Record<string, any>>(client: T, options?: RedisMonitorOptions): RedisMonitorHandle {
    const config = getMonitorConfig();
    if (!config.redisMonitorEnabled) {
        return {
            getRedisMetrics: () => createMetrics(),
            resetRedisMetrics: () => undefined,
            destroy: () => undefined,
        };
    }

    const resolvedOptions = normalizeOptions(options);
    const logger = resolvedOptions.loggerEnabled ? getLogger() : null;
    const ignoredCommands = new Set(resolvedOptions.ignoredCommands);
    const metrics = createMetrics();

    const recordLatency = (durationMs: number) => {
        if (!Number.isFinite(durationMs)) {
            return;
        }

        const total = metrics.commandsExecuted * metrics.averageLatencyMs + durationMs;
        metrics.averageLatencyMs = total / Math.max(metrics.commandsExecuted, 1);
    };

    const wrapCommand = (commandName: string, invoke: (...args: any[]) => any) => {
        return (...args: any[]) => {
            const startedAt = Date.now();
            const maybePromise = invoke(...args);
            const finalize = (error?: unknown) => {
                const duration = Date.now() - startedAt;
                metrics.commandsExecuted += 1;
                metrics.lastCommandAt = Date.now();
                metrics.bytesSent += JSON.stringify(args).length;
                recordLatency(duration);
                if (duration >= resolvedOptions.slowCommandThreshold) {
                    metrics.slowCommands += 1;
                    if (logger) {
                        logger.warn("slow redis command", { command: commandName, durationMs: duration });
                    }
                }
                if (error) {
                    metrics.failedCommands += 1;
                    metrics.errors += 1;
                    metrics.lastErrorAt = Date.now();
                    if (logger) {
                        logger.error("redis error", { command: commandName, error });
                    }
                }
            };

            if (maybePromise && typeof maybePromise.then === "function") {
                return maybePromise.then(
                    (value: unknown) => {
                        finalize();
                        return value;
                    },
                    (error: unknown) => {
                        finalize(error);
                        throw error;
                    },
                );
            }

            finalize();
            return maybePromise;
        };
    };

    const wrapCommandMethod = (methodName: string) => {
        const original = (client as any)[methodName];
        if (typeof original !== "function") {
            return;
        }

        (client as any)[methodName] = (...args: any[]) => {
            if (ignoredCommands.has(methodName)) {
                return original(...args);
            }
            if (methodName === "pipeline") {
                metrics.pipelineCount += 1;
            }
            if (methodName === "publish" || methodName === "subscribe") {
                metrics.pubSubMessages += 1;
            }
            return wrapCommand(methodName, original)(...args);
        };
    };

    const knownMethods = ["connect", "disconnect", "subscribe", "publish", "pipeline", "info"];
    for (const method of knownMethods) {
        wrapCommandMethod(method);
    }

    const onConnect = () => {
        metrics.connect += 1;
        metrics.ready += 1;
        if (logger) {
            logger.info("redis connected", {});
        }
    };

    const onReady = () => {
        metrics.ready += 1;
        if (logger) {
            logger.info("redis ready", {});
        }
    };

    const onReconnecting = () => {
        metrics.reconnecting += 1;
        if (logger) {
            logger.warn("redis reconnecting", {});
        }
    };

    const onDisconnect = () => {
        metrics.disconnect += 1;
        if (logger) {
            logger.warn("redis disconnected", {});
        }
    };

    const onError = (error: unknown) => {
        metrics.errors += 1;
        metrics.lastErrorAt = Date.now();
        if (logger) {
            logger.error("redis error", error);
        }
    };

    const onInfo = (info: string) => {
        const match = info.match(/used_memory:(\d+)/i);
        if (match?.[1]) {
            metrics.memoryUsageBytes = Number(match[1]);
        }
    };

    const eventTargets = [client as any];
    const eventNames = ["connect", "ready", "reconnecting", "disconnect", "error"];

    for (const target of eventTargets) {
        for (const eventName of eventNames) {
            if (typeof target?.on === "function") {
                target.on(eventName, eventName === "connect" ? onConnect : eventName === "ready" ? onReady : eventName === "reconnecting" ? onReconnecting : eventName === "disconnect" ? onDisconnect : onError);
            }
        }
    }

    if (typeof (client as any).on === "function") {
        (client as any).on("info", onInfo);
    }

    return {
        getRedisMetrics: () => ({ ...metrics }),
        resetRedisMetrics: () => {
            Object.assign(metrics, createMetrics());
        },
        destroy: () => {
            if (typeof (client as any).removeListener === "function") {
                (client as any).removeListener("connect", onConnect);
                (client as any).removeListener("ready", onReady);
                (client as any).removeListener("reconnecting", onReconnecting);
                (client as any).removeListener("disconnect", onDisconnect);
                (client as any).removeListener("error", onError);
                (client as any).removeListener("info", onInfo);
            }
        },
    };
}

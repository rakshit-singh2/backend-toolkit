import { getMonitorConfig } from "../config/index.js";
import { logger as baseLogger } from "../logger/index.js";
import type { SocketMonitorHandle, SocketMonitorOptions, SocketMetrics } from "./types.js";

const DEFAULT_IGNORED_EVENTS = new Set(["ping", "pong"]);

function getLogger() {
    return baseLogger.child({ component: "socketio" });
}

function normalizeOptions(options?: SocketMonitorOptions): Required<SocketMonitorOptions> {
    const config = getMonitorConfig();
    return {
        ignoredEvents: options?.ignoredEvents ?? [],
        slowEventThresholdMs: options?.slowEventThresholdMs ?? config.socketSlowEventThresholdMs,
        samplePayload: options?.samplePayload ?? false,
        sampleRate: options?.sampleRate ?? 1,
        loggerEnabled: options?.loggerEnabled ?? true,
    };
}

function createMetrics(): SocketMetrics {
    return {
        totalConnections: 0,
        activeConnections: 0,
        disconnects: 0,
        reconnects: 0,
        roomsJoined: 0,
        roomsLeft: 0,
        eventsReceived: 0,
        eventsEmitted: 0,
        bytesIn: 0,
        bytesOut: 0,
        acknowledgements: 0,
        averageEventProcessingTimeMs: 0,
        slowEvents: 0,
        errors: 0,
        eventFrequency: {},
        middlewareExecutionTimeMs: 0,
        namespaces: {},
    };
}

/**
 * Wraps a Socket.IO server and collects connection, event, and middleware metrics.
 */
export function monitorSocketIO<T extends { on: (...args: any[]) => any; use: (...args: any[]) => any; of: (...args: any[]) => any; }>(
    io: T,
    options?: SocketMonitorOptions,
): SocketMonitorHandle {
    const config = getMonitorConfig();
    if (!config.socketMonitorEnabled) {
        return {
            getSocketMetrics: () => createMetrics(),
            resetSocketMetrics: () => undefined,
            destroy: () => undefined,
        };
    }

    const resolvedOptions = normalizeOptions(options);
    const logger = resolvedOptions.loggerEnabled ? getLogger() : null;
    const ignoredEvents = new Set([...DEFAULT_IGNORED_EVENTS, ...resolvedOptions.ignoredEvents]);
    const metrics = createMetrics();
    const namespaces = new Set<string>();

    const recordEventFrequency = (eventName: string) => {
        const current = metrics.eventFrequency[eventName] ?? 0;
        metrics.eventFrequency[eventName] = current + 1;
    };

    const recordProcessingTime = (durationMs: number) => {
        if (!Number.isFinite(durationMs)) {
            return;
        }

        const total = metrics.eventsReceived * metrics.averageEventProcessingTimeMs + durationMs;
        metrics.averageEventProcessingTimeMs = total / Math.max(metrics.eventsReceived, 1);
    };

    const recordNamespace = (ns: string) => {
        const current = metrics.namespaces[ns] ?? 0;
        metrics.namespaces[ns] = current + 1;
    };

    const onConnection = (socket: any) => {
        metrics.totalConnections += 1;
        metrics.activeConnections += 1;
        recordNamespace(socket.nsp?.name ?? "/");
        namespaces.add(socket.nsp?.name ?? "/");

        if (logger) {
            logger.info("socket connected", {
                socketId: socket.id,
                namespace: socket.nsp?.name ?? "/",
            });
        }

        const onDisconnect = (reason: unknown) => {
            metrics.disconnects += 1;
            metrics.activeConnections = Math.max(0, metrics.activeConnections - 1);
            if (logger) {
                logger.warn("socket disconnected", {
                    socketId: socket.id,
                    reason,
                });
            }
        };

        const onReconnect = () => {
            metrics.reconnects += 1;
            if (logger) {
                logger.info("socket reconnected", {
                    socketId: socket.id,
                });
            }
        };

        const onJoinRoom = (room: string) => {
            metrics.roomsJoined += 1;
            if (logger) {
                logger.debug("socket room joined", { socketId: socket.id, room });
            }
        };

        const onLeaveRoom = (room: string) => {
            metrics.roomsLeft += 1;
            if (logger) {
                logger.debug("socket room left", { socketId: socket.id, room });
            }
        };

        const onAny = (eventName: string, ...payload: any[]) => {
            if (ignoredEvents.has(eventName)) {
                return;
            }

            metrics.eventsReceived += 1;
            metrics.bytesIn += JSON.stringify(payload).length;
            recordEventFrequency(eventName);
            metrics.lastEventAt = Date.now();

            if (resolvedOptions.sampleRate < 1 && Math.random() > resolvedOptions.sampleRate) {
                return;
            }

            const startedAt = Date.now();
            recordProcessingTime(Date.now() - startedAt);

            if (payload.length && resolvedOptions.samplePayload) {
                if (logger) {
                    logger.debug("socket event received", {
                        socketId: socket.id,
                        event: eventName,
                        payload,
                    });
                }
            }
        };

        const onAnyOutgoing = (eventName: string, ...payload: any[]) => {
            if (ignoredEvents.has(eventName)) {
                return;
            }
            metrics.eventsEmitted += 1;
            metrics.bytesOut += JSON.stringify(payload).length;
            metrics.lastEventAt = Date.now();
        };

        const onAck = (...args: any[]) => {
            metrics.acknowledgements += 1;
            metrics.bytesOut += JSON.stringify(args).length;
        };

        const onError = (error: unknown) => {
            metrics.errors += 1;
            metrics.lastErrorAt = Date.now();
            if (logger) {
                logger.error("socket error", error);
            }
        };

        socket.on("disconnect", onDisconnect);
        socket.on("reconnect", onReconnect);
        socket.on("join", onJoinRoom);
        socket.on("leave", onLeaveRoom);
        socket.onAny(onAny);
        socket.onAnyOutgoing(onAnyOutgoing);
        socket.on("ack", onAck);
        socket.on("error", onError);

        socket.on("disconnect", () => {
            socket.off("disconnect", onDisconnect);
            socket.off("reconnect", onReconnect);
            socket.off("join", onJoinRoom);
            socket.off("leave", onLeaveRoom);
            socket.offAny(onAny);
            socket.offAnyOutgoing(onAnyOutgoing);
            socket.off("ack", onAck);
            socket.off("error", onError);
        });
    };

    const onMiddleware = (packet: any, next: (err?: Error) => void) => {
        const startedAt = Date.now();
        next();
        const duration = Date.now() - startedAt;
        metrics.middlewareExecutionTimeMs += duration;
        recordProcessingTime(duration);
        if (duration >= resolvedOptions.slowEventThresholdMs) {
            metrics.slowEvents += 1;
            if (logger) {
                logger.warn("slow socket event", { durationMs: duration });
            }
        }
    };

    const connectionHandler = (socket: any) => {
        onConnection(socket);
    };

    const server = io as any;
    server.on("connection", connectionHandler);
    server.use?.(onMiddleware);

    return {
        getSocketMetrics: () => ({
            ...metrics,
            eventFrequency: { ...metrics.eventFrequency },
            namespaces: { ...metrics.namespaces },
        }),
        resetSocketMetrics: () => {
            Object.assign(metrics, createMetrics());
        },
        destroy: () => {
            server.off?.("connection", connectionHandler);
            namespaces.clear();
        },
    };
}

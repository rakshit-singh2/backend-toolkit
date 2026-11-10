import { monitorRedis } from "./redis/index.js";
import { monitorSocketIO } from "./socketio/index.js";
import { startPerformanceMonitor } from "./performance/index.js";
import { monitorGraphQL } from "./graphql/index.js";

export * from "./logger/index.js";
export * from "./mongoose/index.js";
export * from "./graphql/index.js";
export * from "./socketio/index.js";
export * from "./express/index.js";
export * from "./redis/index.js";
export * from "./performance/index.js";
export * from "./config/index.js";

export function selfValidateMonitoring(): string[] {
    const results: string[] = [];

    try {
        const socketHandle = monitorSocketIO({ on: () => undefined, use: () => undefined, of: () => undefined } as any);
        socketHandle.resetSocketMetrics();
        socketHandle.destroy();
        results.push("socketio:ok");
    } catch (error) {
        results.push(`socketio:fail:${String(error)}`);
    }

    try {
        const redisHandle = monitorRedis({ on: () => undefined, removeListener: () => undefined } as any);
        redisHandle.resetRedisMetrics();
        redisHandle.destroy();
        results.push("redis:ok");
    } catch (error) {
        results.push(`redis:fail:${String(error)}`);
    }

    try {
        const perfHandle = startPerformanceMonitor({ intervalMs: 10, loggerEnabled: false });
        perfHandle.stop();
        results.push("performance:ok");
    } catch (error) {
        results.push(`performance:fail:${String(error)}`);
    }

    try {
        const graphqlHandle = monitorGraphQL(
            () => ({ data: null }),
            { loggerEnabled: false },
        );
        graphqlHandle.resetGraphQLMetrics();
        results.push("graphql:ok");
    } catch (error) {
        results.push(`graphql:fail:${String(error)}`);
    }

    return results;
}
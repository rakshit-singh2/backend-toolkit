export interface RedisMonitorOptions {
    slowCommandThreshold?: number;
    ignoredCommands?: string[];
    loggerEnabled?: boolean;
}

export interface RedisMetrics {
    connect: number;
    ready: number;
    reconnecting: number;
    disconnect: number;
    errors: number;
    commandsExecuted: number;
    failedCommands: number;
    pipelineCount: number;
    pubSubMessages: number;
    averageLatencyMs: number;
    slowCommands: number;
    bytesSent: number;
    bytesReceived: number;
    memoryUsageBytes?: number;
    lastCommandAt?: number;
    lastErrorAt?: number;
}

export interface RedisMonitorHandle {
    getRedisMetrics(): RedisMetrics;
    resetRedisMetrics(): void;
    destroy(): void;
}

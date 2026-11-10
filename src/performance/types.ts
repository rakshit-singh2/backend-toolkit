export interface PerformanceMetrics {
    eventLoopLagMs: number;
    heapUsedBytes: number;
    heapTotalBytes: number;
    rssBytes: number;
    externalBytes: number;
    cpuUsage: {
        user: number;
        system: number;
    };
    uptimeMs: number;
    requestRate: number;
    socketEventRate: number;
    redisCommandRate: number;
    timestamp: number;
}

export interface PerformanceMonitorHandle {
    getPerformanceMetrics(): PerformanceMetrics;
    stop(): void;
}

export interface PerformanceMonitorOptions {
    intervalMs?: number;
    loggerEnabled?: boolean;
}

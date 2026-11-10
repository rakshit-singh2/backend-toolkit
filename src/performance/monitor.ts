import { getMonitorConfig } from "../config/index.js";
import { logger as baseLogger } from "../logger/index.js";
import type { PerformanceMetrics, PerformanceMonitorHandle, PerformanceMonitorOptions } from "./types.js";

function getLogger() {
    return baseLogger.child({ component: "performance" });
}

function normalizeOptions(options?: PerformanceMonitorOptions): Required<PerformanceMonitorOptions> {
    const config = getMonitorConfig();
    return {
        intervalMs: options?.intervalMs ?? config.performanceMonitorIntervalMs,
        loggerEnabled: options?.loggerEnabled ?? true,
    };
}

function createMetrics(): PerformanceMetrics {
    return {
        eventLoopLagMs: 0,
        heapUsedBytes: 0,
        heapTotalBytes: 0,
        rssBytes: 0,
        externalBytes: 0,
        cpuUsage: { user: 0, system: 0 },
        uptimeMs: 0,
        requestRate: 0,
        socketEventRate: 0,
        redisCommandRate: 0,
        timestamp: Date.now(),
    };
}

/**
 * Starts a lightweight performance sampler for event-loop, memory, and process metrics.
 */
export function startPerformanceMonitor(options?: PerformanceMonitorOptions): PerformanceMonitorHandle {
    const config = getMonitorConfig();
    if (!config.performanceMonitorEnabled) {
        return {
            getPerformanceMetrics: () => createMetrics(),
            stop: () => undefined,
        };
    }

    const resolvedOptions = normalizeOptions(options);
    const logger = resolvedOptions.loggerEnabled ? getLogger() : null;
    const metrics = createMetrics();
    let timer: NodeJS.Timeout | null = null;
    let lastCpu = process.cpuUsage();
    let lastTime = Date.now();

    const collect = () => {
        const mem = process.memoryUsage();
        const now = Date.now();
        const elapsed = Math.max(now - lastTime, 1);
        const cpu = process.cpuUsage();
        const userDelta = cpu.user - lastCpu.user;
        const systemDelta = cpu.system - lastCpu.system;
        const totalCpuDelta = userDelta + systemDelta;
        const cpuPercent = elapsed > 0 ? (totalCpuDelta / (elapsed * 1000)) * 100 : 0;

        const start = process.hrtime.bigint();
        setImmediate(() => {
            const lag = Number(process.hrtime.bigint() - start) / 1e6;
            metrics.eventLoopLagMs = Math.max(0, lag);
        });
        metrics.heapUsedBytes = mem.heapUsed;
        metrics.heapTotalBytes = mem.heapTotal;
        metrics.rssBytes = mem.rss;
        metrics.externalBytes = mem.external;
        metrics.cpuUsage = {
            user: Number((userDelta / 1000).toFixed(2)),
            system: Number((systemDelta / 1000).toFixed(2)),
        };
        metrics.uptimeMs = process.uptime() * 1000;
        metrics.timestamp = now;

        if (cpuPercent > 80 && logger) {
            logger.warn("high cpu usage", { cpuPercent: Number(cpuPercent.toFixed(2)) });
        }

        lastCpu = cpu;
        lastTime = now;
    };

    collect();
    timer = setInterval(() => {
        collect();
    }, resolvedOptions.intervalMs);

    return {
        getPerformanceMetrics: () => ({ ...metrics, cpuUsage: { ...metrics.cpuUsage } }),
        stop: () => {
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
        },
    };
}

export function stopPerformanceMonitor(handle?: PerformanceMonitorHandle): void {
    handle?.stop();
}

export function getPerformanceMetrics(handle?: PerformanceMonitorHandle): PerformanceMetrics {
    return handle?.getPerformanceMetrics() ?? createMetrics();
}

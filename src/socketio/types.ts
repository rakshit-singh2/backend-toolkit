export interface SocketMonitorOptions {
    ignoredEvents?: string[];
    slowEventThresholdMs?: number;
    samplePayload?: boolean;
    sampleRate?: number;
    loggerEnabled?: boolean;
}

export interface SocketMetrics {
    totalConnections: number;
    activeConnections: number;
    disconnects: number;
    reconnects: number;
    roomsJoined: number;
    roomsLeft: number;
    eventsReceived: number;
    eventsEmitted: number;
    bytesIn: number;
    bytesOut: number;
    acknowledgements: number;
    averageEventProcessingTimeMs: number;
    slowEvents: number;
    errors: number;
    eventFrequency: Record<string, number>;
    middlewareExecutionTimeMs: number;
    namespaces: Record<string, number>;
    lastEventAt?: number;
    lastErrorAt?: number;
}

export interface SocketMonitorHandle {
    getSocketMetrics(): SocketMetrics;
    resetSocketMetrics(): void;
    destroy(): void;
}

export interface RequestLoggerOptions {
    loggerEnabled?: boolean;
    /** This backend instance's own service name, used when the caller sends no X-Service-Name header. */
    serviceName?: string;
    /** Log request query/params/body. Defaults to true outside production. */
    logRequestBody?: boolean;
    /** Log the response payload. Defaults to true outside production. */
    logResponseBody?: boolean;
    slowRequestThresholdMs?: number;
    ignoredPaths?: string[];
}

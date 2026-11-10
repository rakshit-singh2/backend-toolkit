import { getMonitorConfig } from "../config/index.js";
import { logger as baseLogger } from "../logger/index.js";
import { resolveDeviceInfo, resolveServiceName } from "./deviceInfo.js";
import type { RequestLoggerOptions } from "./types.js";

function getLogger() {
    return baseLogger.child({ component: "express" });
}

function resolveInputType(req: any): string {
    const contentType = req?.headers?.["content-type"];
    if (contentType) {
        return String(contentType).split(";")[0].trim();
    }
    if (req?.method === "GET" || req?.method === "DELETE") {
        return "query";
    }
    return "none";
}

/**
 * Creates an Express-style middleware that logs each request's method, path, service,
 * calling device, input type/payload, response, and duration. Request/response bodies
 * are logged only outside production unless explicitly overridden.
 */
export function createRequestLoggerMiddleware(options: RequestLoggerOptions = {}) {
    const config = getMonitorConfig();
    if (!config.requestMonitorEnabled) {
        return (_req: any, _res: any, next: () => void) => next();
    }

    const resolvedOptions = {
        loggerEnabled: options.loggerEnabled ?? true,
        serviceName: options.serviceName ?? config.defaultServiceName,
        logRequestBody: options.logRequestBody ?? !config.isProduction,
        logResponseBody: options.logResponseBody ?? !config.isProduction,
        slowRequestThresholdMs: options.slowRequestThresholdMs ?? 1000,
        ignoredPaths: new Set(options.ignoredPaths ?? []),
    };
    const logger = resolvedOptions.loggerEnabled ? getLogger() : null;

    return (req: any, res: any, next: () => void) => {
        const path = req?.path ?? req?.url;
        if (!logger || resolvedOptions.ignoredPaths.has(path)) {
            next();
            return;
        }

        const startedAt = Date.now();
        const service = resolveServiceName(req, resolvedOptions.serviceName);
        const device = resolveDeviceInfo(req);
        const inputType = resolveInputType(req);

        let responseBody: unknown;
        if (resolvedOptions.logResponseBody && typeof res?.json === "function") {
            const originalJson = res.json.bind(res);
            res.json = (body: unknown) => {
                responseBody = body;
                return originalJson(body);
            };
        }

        logger.info("request received", {
            method: req?.method,
            path,
            service,
            device: device.deviceName,
            deviceType: device.deviceType,
            inputType,
            ...(resolvedOptions.logRequestBody
                ? { query: req?.query, params: req?.params, body: req?.body }
                : {}),
        });

        let finished = false;
        const done = () => {
            if (finished) {
                return;
            }
            finished = true;

            const durationMs = Date.now() - startedAt;
            const statusCode = res?.statusCode;
            const isSlow = durationMs >= resolvedOptions.slowRequestThresholdMs;

            const completionPayload = {
                method: req?.method,
                path,
                service,
                device: device.deviceName,
                statusCode,
                durationMs,
                ...(resolvedOptions.logResponseBody ? { response: responseBody } : {}),
            };

            if (statusCode >= 500) {
                logger.error("request completed", completionPayload);
            } else if (statusCode >= 400 || isSlow) {
                logger.warn("request completed", completionPayload);
            } else {
                logger.debug("request completed", completionPayload);
            }
        };

        if (typeof res?.once === "function") {
            res.once("finish", done);
            res.once("close", done);
        }

        next();
    };
}

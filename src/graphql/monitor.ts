import { getMonitorConfig } from "../config/index.js";
import { logger as baseLogger } from "../logger/index.js";
import type {
    GraphQLExecuteFn,
    GraphQLExecutionArgsLike,
    GraphQLExecutionResultLike,
    GraphQLMetrics,
    GraphQLMonitorHandle,
    GraphQLMonitorOptions,
} from "./types.js";

function getLogger() {
    return baseLogger.child({ component: "graphql" });
}

function createMetrics(): GraphQLMetrics {
    return {
        totalOperations: 0,
        queries: 0,
        mutations: 0,
        subscriptions: 0,
        errors: 0,
        slowOperations: 0,
        averageDurationMs: 0,
        operationFrequency: {},
    };
}

function resolveOperationType(args: GraphQLExecutionArgsLike): "query" | "mutation" | "subscription" | "unknown" {
    const definitions = args.document?.definitions ?? [];
    const definition = args.operationName
        ? definitions.find((d) => d.kind === "OperationDefinition" && d.name?.value === args.operationName)
        : definitions.find((d) => d.kind === "OperationDefinition");

    switch (definition?.operation) {
        case "query":
        case "mutation":
        case "subscription":
            return definition.operation;
        default:
            return "unknown";
    }
}

/**
 * Wraps a graphql-js compatible `execute` function and collects operation metrics.
 * Framework-agnostic: works with plain graphql-js, Apollo Server, graphql-yoga, etc.
 * since they all ultimately call an `execute({ document, variableValues, operationName })`.
 */
export function monitorGraphQL<
    Args extends GraphQLExecutionArgsLike = GraphQLExecutionArgsLike,
    Result extends GraphQLExecutionResultLike = GraphQLExecutionResultLike,
>(
    executeFn: GraphQLExecuteFn<Args, Result>,
    options?: GraphQLMonitorOptions,
): { execute: GraphQLExecuteFn<Args, Result> } & GraphQLMonitorHandle {
    const config = getMonitorConfig();
    const metrics = createMetrics();

    if (!config.graphqlMonitorEnabled) {
        return {
            execute: executeFn,
            getGraphQLMetrics: () => createMetrics(),
            resetGraphQLMetrics: () => undefined,
        };
    }

    const resolvedOptions = {
        loggerEnabled: options?.loggerEnabled ?? true,
        slowOperationThresholdMs: options?.slowOperationThresholdMs ?? 200,
        logVariables: options?.logVariables ?? !config.isProduction,
    };
    const logger = resolvedOptions.loggerEnabled ? getLogger() : null;

    const execute: GraphQLExecuteFn<Args, Result> = async (args) => {
        const operationType = resolveOperationType(args);
        const operationName = args.operationName ?? "anonymous";
        const startedAt = Date.now();

        metrics.totalOperations += 1;
        if (operationType === "query") metrics.queries += 1;
        else if (operationType === "mutation") metrics.mutations += 1;
        else if (operationType === "subscription") metrics.subscriptions += 1;

        const frequencyKey = `${operationType}:${operationName}`;
        metrics.operationFrequency[frequencyKey] = (metrics.operationFrequency[frequencyKey] ?? 0) + 1;

        const result = await executeFn(args);
        const durationMs = Date.now() - startedAt;

        metrics.lastOperationAt = Date.now();
        const total = (metrics.totalOperations - 1) * metrics.averageDurationMs + durationMs;
        metrics.averageDurationMs = total / metrics.totalOperations;

        const hasErrors = Boolean(result?.errors?.length);
        if (hasErrors) {
            metrics.errors += 1;
            metrics.lastErrorAt = Date.now();
        }

        const isSlow = durationMs >= resolvedOptions.slowOperationThresholdMs;
        if (isSlow) {
            metrics.slowOperations += 1;
        }

        if (logger) {
            const logPayload: Record<string, unknown> = {
                operationType,
                operationName,
                durationMs,
                ...(resolvedOptions.logVariables ? { variables: args.variableValues } : {}),
            };

            if (hasErrors) {
                logger.error("graphql operation failed", { ...logPayload, errors: result.errors });
            } else if (isSlow) {
                logger.warn("slow graphql operation", logPayload);
            } else {
                logger.debug("graphql operation completed", logPayload);
            }
        }

        return result;
    };

    return {
        execute,
        getGraphQLMetrics: () => ({
            ...metrics,
            operationFrequency: { ...metrics.operationFrequency },
        }),
        resetGraphQLMetrics: () => {
            Object.assign(metrics, createMetrics());
        },
    };
}

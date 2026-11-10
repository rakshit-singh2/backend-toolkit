export interface GraphQLMonitorOptions {
    loggerEnabled?: boolean;
    slowOperationThresholdMs?: number;
    /** Log variableValues on each operation. Defaults to true outside production. */
    logVariables?: boolean;
}

export interface GraphQLMetrics {
    totalOperations: number;
    queries: number;
    mutations: number;
    subscriptions: number;
    errors: number;
    slowOperations: number;
    averageDurationMs: number;
    operationFrequency: Record<string, number>;
    lastOperationAt?: number;
    lastErrorAt?: number;
}

export interface GraphQLMonitorHandle {
    getGraphQLMetrics(): GraphQLMetrics;
    resetGraphQLMetrics(): void;
}

/**
 * Minimal structural shape of graphql-js's ExecutionArgs/ExecutionResult so this
 * package doesn't need a hard dependency on the `graphql` package for types.
 */
export interface GraphQLExecutionArgsLike {
    document: {
        definitions?: readonly {
            kind: string;
            operation?: string;
            name?: { value?: string };
        }[];
    };
    variableValues?: Record<string, unknown> | null;
    operationName?: string | null;
    contextValue?: unknown;
}

export interface GraphQLExecutionResultLike {
    data?: unknown;
    errors?: readonly unknown[];
}

export type GraphQLExecuteFn<
    Args extends GraphQLExecutionArgsLike = GraphQLExecutionArgsLike,
    Result extends GraphQLExecutionResultLike = GraphQLExecutionResultLike,
> = (args: Args) => Promise<Result> | Result;

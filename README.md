# my-backend-toolkit

A small TypeScript toolkit for backend utilities, logging, and lightweight monitoring helpers.

## Installation

```bash
npm install my-backend-toolkit
```

## Socket.IO monitoring

```ts
import { monitorSocketIO } from "my-backend-toolkit";

const io = new Server(httpServer);
const socketMonitor = monitorSocketIO(io, {
  ignoredEvents: ["ping"],
  slowEventThresholdMs: 50,
  samplePayload: false,
  loggerEnabled: true,
});

console.log(socketMonitor.getSocketMetrics());
```

## Mongo query explain logging (dev only)

```ts
import { initExplainPlugin } from "my-backend-toolkit";

initExplainPlugin();

// In dev, writes an execution-plan JSON file under ./mongo-explains/
// In production this is a no-op.
await User.find({ email }).explainQuery();
await User.aggregate([...]).explainQuery({ label: "activeUsers" });
```

## API request logging

```ts
import { createRequestLoggerMiddleware } from "my-backend-toolkit";

app.use(createRequestLoggerMiddleware({ serviceName: "orders-service" }));
```

Logs method, path, calling service, calling device, input type, and (outside production) the request/response bodies. The calling service and device can be set explicitly by the caller via `X-Service-Name` / `X-Device-Name` headers, otherwise they fall back to this backend's configured `serviceName` and to User-Agent parsing, respectively.

## GraphQL monitoring

```ts
import { execute as graphqlExecute } from "graphql";
import { monitorGraphQL } from "my-backend-toolkit";

const { execute, getGraphQLMetrics } = monitorGraphQL(graphqlExecute);

// Use `execute` wherever you'd normally call graphql-js's execute(),
// e.g. wire it into Apollo Server, graphql-yoga, or your own resolver.
console.log(getGraphQLMetrics());
```

## Redis monitoring

```ts
import { monitorRedis } from "my-backend-toolkit";

const client = createClient();
const redisMonitor = monitorRedis(client, {
  slowCommandThreshold: 20,
  ignoredCommands: ["info"],
  loggerEnabled: true,
});

console.log(redisMonitor.getRedisMetrics());
```

## Performance monitoring

```ts
import { startPerformanceMonitor } from "my-backend-toolkit";

const perfMonitor = startPerformanceMonitor({ intervalMs: 5000, loggerEnabled: true });
console.log(perfMonitor.getPerformanceMetrics());
```

## Express integration

```ts
import { logger } from "my-backend-toolkit";

app.use((req, res, next) => {
  logger.info("request received", { method: req.method, path: req.path });
  next();
});
```

## Environment variables

The monitors respect these optional environment variables:

- TOOLKIT_SOCKET_MONITOR
- TOOLKIT_SOCKET_SLOW_EVENT_MS
- TOOLKIT_REDIS_MONITOR
- TOOLKIT_REDIS_SLOW_COMMAND_MS
- TOOLKIT_PERFORMANCE_MONITOR
- TOOLKIT_MONITOR_INTERVAL
- TOOLKIT_REQUEST_MONITOR
- TOOLKIT_GRAPHQL_MONITOR
- TOOLKIT_SERVICE_NAME

The Mongo explain plugin and the dev-verbose request/GraphQL logging all key off `NODE_ENV`: verbose in any non-`production` environment, lean/quiet in `production`.

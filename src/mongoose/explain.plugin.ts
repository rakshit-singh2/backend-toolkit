
import mongoose, {
    Aggregate,
    Query,
} from "mongoose";
import type { ExplainVerbosityLike } from "mongodb";
import fs from "fs/promises";
import path from "path";
import { getMonitorConfig } from "../config/index.js";

const EXPLAIN_DIR = path.resolve("mongo-explains");

interface CallerInfo {
    file: string;
    line: string;
}

interface FileNameOptions extends CallerInfo {
    model: string;
    operation: string;
}

interface ExplainOptions {
    verbosity?: ExplainVerbosityLike;
    label?: string;
}

async function ensureDir(): Promise<void> {
    await fs.mkdir(EXPLAIN_DIR, {
        recursive: true,
    });
}

function sanitize(value: string): string {
    return value.replace(/[\\/:\s]/g, "-");
}

function getCallerInfo(): CallerInfo {
    const stack = new Error().stack?.split("\n") ?? [];

    /**
     * Skip:
     * 0 => Error
     * 1 => explainQuery
     * 2 => mongoose internals
     * 3+ => actual caller
     */
    const callerLine =
        stack.find(
            (line) =>
                line.includes("/src/") &&
                !line.includes("explain.plugin")
        ) ?? "";

    const match =
        callerLine.match(/\((.*):(\d+):(\d+)\)/) ??
        callerLine.match(/at (.*):(\d+):(\d+)/);

    if (!match) {
        return {
            file: "unknown",
            line: "0",
        };
    }

    return {
        file: sanitize(path.relative(process.cwd(), match[1])),
        line: match[2],
    };
}

function fileName({
    model,
    operation,
    file,
    line,
}: FileNameOptions): string {
    const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-");

    return `${timestamp}-${model}-${operation}-${file}-L${line}.json`;
}

export function initExplainPlugin(): void {
    if (
        (
            mongoose.Aggregate.prototype as Aggregate<any> & {
                explainQuery?: (
                    options?: ExplainOptions
                ) => Promise<Aggregate<any>>;
            }
        ).explainQuery
    ) {
        return;
    }

    /**
     * Aggregate
     */
    (
        mongoose.Aggregate.prototype as Aggregate<any> & {
            explainQuery?: (
                options?: ExplainOptions
            ) => Promise<Aggregate<any>>;
        }
    ).explainQuery = async function (
        this: Aggregate<any>,
        {
            verbosity = "executionStats",
            label = "aggregate",
        }: ExplainOptions = {},
    ): Promise<Aggregate<any>> {
        if (getMonitorConfig().isProduction) {
            return this;
        }

        await ensureDir();

        const model = this.model();
        const explain = await model.collection
            .aggregate(this.pipeline())
            .explain(verbosity);

        const caller = getCallerInfo();

        const filePath = path.join(
            EXPLAIN_DIR,
            fileName({
                model: model.modelName,
                operation: label,
                ...caller,
            })
        );

        await fs.writeFile(
            filePath,
            JSON.stringify(explain, null, 2),
            "utf8"
        );

        return this;
    };

    /**
     * Query
     */
    (
        mongoose.Query.prototype as Query<any, any> & {
            explainQuery?: (
                options?: ExplainOptions
            ) => Promise<Query<any, any>>;
        }
    ).explainQuery = async function (
        this: Query<any, any>,
        {
            verbosity = "executionStats",
            label = (this as unknown as { op: string }).op,
        }: ExplainOptions = {},
    ): Promise<Query<any, any>> {
        if (getMonitorConfig().isProduction) {
            return this;
        }

        await ensureDir();

        const explain = await this.clone().explain(verbosity);

        const caller = getCallerInfo();

        const filePath = path.join(
            EXPLAIN_DIR,
            fileName({
                model: this.model.modelName,
                operation: label,
                ...caller,
            })
        );

        await fs.writeFile(
            filePath,
            JSON.stringify(explain, null, 2),
            "utf8"
        );

        return this;
    };
}
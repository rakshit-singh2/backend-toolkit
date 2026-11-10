import "mongoose";
import type { ExplainVerbosityLike } from "mongodb";

declare module "mongoose" {
    interface Aggregate<ResultType> {
        explainQuery(options?: {
            verbosity?: ExplainVerbosityLike;
            label?: string;
        }): Promise<this>;
    }

    interface Query<
        ResultType,
        DocType,
        THelpers = {},
        RawDocType = unknown,
        QueryOp = "find",
        TDocOverrides = Record<string, never>
    > {
        explainQuery(options?: {
            verbosity?: ExplainVerbosityLike;
            label?: string;
        }): Promise<this>;
    }
}
"use client";

import { PriceSnapshot } from "./price-snapshot";
import { makeAssistantToolUI } from "@assistant-ui/react";

type PriceSnapshotToolArgs = {
  ticker: string;
};
type PriceSnapshotToolResult = {
  snapshot: {
    price: number;
    day_change: number;
    day_change_percent: number;
    time: string;
  };
};
export const PriceSnapshotTool = makeAssistantToolUI<
  PriceSnapshotToolArgs,
  string
>({
  toolName: "price_snapshot",
  render: function PriceSnapshotUI({ part: { args, result } }) {
    let resultObj: PriceSnapshotToolResult | { error: string };
    try {
      resultObj = result ? JSON.parse(result) : {};
    } catch (e) {
      resultObj = { error: result! };
    }

    return (
      <div className="mb-4 flex flex-col items-center gap-2">
        <pre className="whitespace-pre-wrap break-all text-center">
          price_snapshot({JSON.stringify(args)})
        </pre>
        {"snapshot" in resultObj && (
          <PriceSnapshot ticker={args.ticker} {...resultObj.snapshot} />
        )}
        {"error" in resultObj && (
          <p className="text-red-500">{resultObj.error}</p>
        )}
      </div>
    );
  },
});

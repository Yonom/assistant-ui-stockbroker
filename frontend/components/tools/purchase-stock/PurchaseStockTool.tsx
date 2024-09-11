"use client";

import { TransactionConfirmationPending } from "./transaction-confirmation-pending";
import { TransactionConfirmationFinal } from "./transaction-confirmation-final";
import { makeAssistantToolUI, useThreadContext } from "@assistant-ui/react";
import { updateState } from "@/lib/chatApi";

type PurchaseStockArgs = {
  ticker: string;
  companyName: string;
  quantity: number;
  maxPurchasePrice: number;
};
// The JSON to update state with if the user confirms the purchase.
const CONFIRM_PURCHASE = {
  purchaseConfirmed: true,
};
// The name of the node to update the state as
const PREPARE_PURCHASE_DETAILS_NODE = "prepare_purchase_details";

export const PurchaseStockTool = makeAssistantToolUI<PurchaseStockArgs, string>(
  {
    toolName: "purchase_stock",
    render: function PurchaseStockUI({
      part: { args, argsText, result },
      status,
      addResult,
    }) {
      const hasResult = !!result;

      const handleConfirm = async () => {
        addResult({ approve: true });
      };

      return (
        <div className="mb-4 flex flex-col items-center gap-2">
          <pre className="whitespace-pre-wrap">purchase_stock({argsText})</pre>
          {!hasResult && status.type !== "running" && (
            <TransactionConfirmationPending
              {...args}
              onConfirm={handleConfirm}
            />
          )}
          {hasResult && <TransactionConfirmationFinal {...args} />}
        </div>
      );
    },
  }
);

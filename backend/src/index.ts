import { ToolNode } from "@langchain/langgraph/prebuilt";
import {
  Annotation,
  END,
  START,
  StateGraph,
  NodeInterrupt,
  MessagesAnnotation,
} from "@langchain/langgraph";
import { BaseMessage, type AIMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import {
  priceSnapshotTool,
  StockPurchase,
  ALL_TOOLS_LIST,
  webSearchTool,
} from "tools.js";
import { z } from "zod";

const GraphAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  requestedStockPurchaseDetails: Annotation<StockPurchase>,
  purchaseConfirmed: Annotation<boolean | undefined>,
});

const llm = new ChatOpenAI({
  model: "gpt-4o",
  temperature: 0,
});

const toolNode = new ToolNode(ALL_TOOLS_LIST);

const callModel = async (state: typeof GraphAnnotation.State) => {
  const { messages } = state;

  const systemMessage = {
    role: "system",
    content:
      "You're an expert financial analyst, tasked with answering the users questions " +
      "about a given company or companies. You do not have up to date information on " +
      "the companies, so you much call tools when answering users questions. " +
      "All financial data tools require a company ticker to be passed in as a parameter. If you " +
      "do not know the ticker, you should use the web search tool to find it.",
  };

  const llmWithTools = llm.bindTools(ALL_TOOLS_LIST);
  const result = await llmWithTools.invoke([systemMessage, ...messages]);
  return { messages: result };
};

const shouldContinue = (state: typeof GraphAnnotation.State) => {
  const { messages, requestedStockPurchaseDetails } = state;

  const lastMessage = messages[messages.length - 1];

  // Cast here since `tool_calls` does not exist on `BaseMessage`
  const messageCastAI = lastMessage as AIMessage;
  if (messageCastAI._getType() !== "ai" || !messageCastAI.tool_calls?.length) {
    // LLM did not call any tools, or it's not an AI message, so we should end.
    return END;
  }

  // If `requestedStockPurchaseDetails` is present, we want to execute the purchase
  if (requestedStockPurchaseDetails) {
    return "execute_purchase";
  }

  const { tool_calls } = messageCastAI;
  if (!tool_calls?.length) {
    throw new Error(
      "Expected tool_calls to be an array with at least one element"
    );
  }

  return tool_calls.map((tc) => {
    if (tc.name === "purchase_stock") {
      // The user is trying to purchase a stock, route to the verify purchase node.
      return "prepare_purchase_details";
    } else {
      return "tools";
    }
  });
};

const findCompanyName = async (companyName: string) => {
  // Use the web search tool to find the ticker symbol for the company.
  const searchResults: string = await webSearchTool.invoke(
    `What is the ticker symbol for ${companyName}?`
  );
  const llmWithTickerOutput = llm.withStructuredOutput(
    z
      .object({
        ticker: z.string().describe("The ticker symbol of the company"),
      })
      .describe(
        `Extract the ticker symbol of ${companyName} from the provided context.`
      ),
    { name: "extract_ticker" }
  );
  const extractedTicker = await llmWithTickerOutput.invoke([
    {
      role: "user",
      content: `Given the following search results, extract the ticker symbol for ${companyName}:\n${searchResults}`,
    },
  ]);

  return extractedTicker.ticker;
};

const preparePurchaseDetails = async (state: typeof GraphAnnotation.State) => {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];
  if (lastMessage._getType() !== "ai") {
    throw new Error("Expected the last message to be an AI message");
  }

  // Cast here since `tool_calls` does not exist on `BaseMessage`
  const messageCastAI = lastMessage as AIMessage;
  const purchaseStockTool = messageCastAI.tool_calls?.find(
    (tc) => tc.name === "purchase_stock"
  );
  if (!purchaseStockTool) {
    throw new Error(
      "Expected the last AI message to have a purchase_stock tool call"
    );
  }
  let { maxPurchasePrice, companyName, ticker } = purchaseStockTool.args;

  if (!ticker) {
    if (!companyName) {
      // The user did not provide the ticker or the company name.
      // Ask the user for the missing information. Also, if the
      // last message had a tool call we need to add a tool message
      // to the messages array.
      const toolMessages = messageCastAI.tool_calls?.map((tc) => {
        return {
          role: "tool",
          content: `Please provide the missing information for the ${tc.name} tool.`,
          id: tc.id,
        };
      });

      return {
        messages: [
          ...(toolMessages ?? []),
          {
            role: "assistant",
            content:
              "Please provide either the company ticker or the company name to purchase stock.",
          },
        ],
      };
    } else {
      // The user did not provide the ticker, but did provide the company name.
      // Call the `findCompanyName` tool to get the ticker.
      ticker = await findCompanyName(purchaseStockTool.args.companyName);
    }
  }

  if (!maxPurchasePrice) {
    // If `maxPurchasePrice` is not defined, default to the current price.
    const priceSnapshot = await priceSnapshotTool.invoke({ ticker });
    maxPurchasePrice = priceSnapshot.snapshot.price;
  }

  // Now we have the final ticker, we can return the purchase information.
  return {
    requestedStockPurchaseDetails: {
      ticker,
      quantity: purchaseStockTool.args.quantity ?? 1, // Default to one if not provided.
      maxPurchasePrice,
    },
  };
};

const executePurchase = async (state: typeof GraphAnnotation.State) => {
  const { purchaseConfirmed, requestedStockPurchaseDetails } = state;
  if (!requestedStockPurchaseDetails) {
    throw new Error("Expected requestedStockPurchaseDetails to be present");
  }
  if (!purchaseConfirmed) {
    // Interrupt the node to request permission to execute the purchase.
    throw new NodeInterrupt("Please confirm the purchase before executing.");
  }

  const { ticker, quantity, maxPurchasePrice } = requestedStockPurchaseDetails;
  // Execute the purchase. In this demo we'll just return a success message.
  return {
    messages: [
      {
        role: "assistant",
        content:
          `Successfully purchased ${quantity} share(s) of ` +
          `${ticker} at $${maxPurchasePrice}/share.`,
      },
    ],
  };
};

const workflow = new StateGraph(GraphAnnotation)
  .addNode("agent", callModel)
  .addEdge(START, "agent")
  .addNode("tools", toolNode)
  .addNode("prepare_purchase_details", preparePurchaseDetails)
  .addNode("execute_purchase", executePurchase)
  .addEdge("prepare_purchase_details", "execute_purchase")
  .addEdge("execute_purchase", END)
  .addEdge("tools", "agent")
  .addConditionalEdges("agent", shouldContinue, [
    "tools",
    END,
    "prepare_purchase_details",
    "execute_purchase",
  ]);

export const graph = workflow.compile({
  // The LangGraph Studio/Cloud API will automatically add a checkpointer
  // only uncomment if running locally
  // checkpointer: new MemorySaver(),
});

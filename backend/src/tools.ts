import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { tool } from "@langchain/core/tools";
import {
  IncomeStatementsResponse,
  BalanceSheetsResponse,
  CashFlowStatementsResponse,
  CompanyFactsResponse,
  SnapshotResponse,
} from "types.js";
import { z } from "zod";

export async function callFinancialDatasetAPI<
  Output extends Record<string, any> = Record<string, any>
>(fields: {
  endpoint: string;
  params: Record<string, string>;
}): Promise<Output> {
  if (!process.env.FINANCIAL_DATASETS_API_KEY) {
    throw new Error("FINANCIAL_DATASETS_API_KEY is not set");
  }

  const baseURL = "https://api.financialdatasets.ai";
  const queryParams = new URLSearchParams(fields.params).toString();
  const url = `${baseURL}${fields.endpoint}?${queryParams}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "X-API-KEY": process.env.FINANCIAL_DATASETS_API_KEY,
    },
  });

  if (!response.ok) {
    let res: string;
    try {
      res = JSON.stringify(await response.json(), null, 2);
    } catch (_) {
      try {
        res = await response.text();
      } catch (_) {
        res = response.statusText;
      }
    }
    throw new Error(
      `Failed to fetch data from ${fields.endpoint}.\nResponse: ${res}`
    );
  }
  const data = await response.json();
  return data;
}

const incomeStatementsTool = tool(
  async (input) => {
    try {
      const data = await callFinancialDatasetAPI<IncomeStatementsResponse>({
        endpoint: "/financials/income-statements",
        params: {
          ticker: input.ticker,
          period: input.period ?? "annual",
          limit: input.limit.toString() ?? "5",
        },
      });
      return JSON.stringify(data, null);
    } catch (e: any) {
      console.warn("Error fetching income statements", e.message);
      return `An error occurred while fetching income statements: ${e.message}`;
    }
  },
  {
    name: "income_statements",
    description:
      "Retrieves income statements for a specified company, showing detailed financial performance over a chosen time period. The output includes key metrics such as revenue, expenses, profits, and per-share data. Specifically, it provides: ticker, date, period type, revenue, cost of revenue, gross profit, operating expenses, income figures (operating, net, EBIT), tax expenses, earnings per share (basic and diluted), dividends per share, and share count information.",
    schema: z.object({
      ticker: z.string().describe("The ticker of the stock. Example: 'AAPL'"),
      period: z
        .enum(["annual", "quarterly", "ttm"])
        .describe("The time period of the income statement. Example: 'annual'")
        .optional()
        .default("annual"),
      limit: z
        .number()
        .int()
        .positive()
        .describe("The number of income statements to return. Example: 5")
        .optional()
        .default(5),
    }),
  }
);

const balanceSheetsTool = tool(
  async (input) => {
    try {
      const data = await callFinancialDatasetAPI<BalanceSheetsResponse>({
        endpoint: "/financials/balance-sheets",
        params: {
          ticker: input.ticker,
          period: input.period ?? "annual",
          limit: input.limit.toString() ?? "5",
        },
      });
      return JSON.stringify(data, null);
    } catch (e: any) {
      console.warn("Error fetching balance sheets", e.message);
      return `An error occurred while fetching balance sheets: ${e.message}`;
    }
  },
  {
    name: "balance_sheets",
    description:
      "Fetches balance sheets for a given company, providing a snapshot of its financial position at specific points in time. The output includes detailed information on assets (total, current, non-current), liabilities (total, current, non-current), and shareholders' equity. Specific data points include cash and equivalents, inventory, investments, property/plant/equipment, goodwill, debt, payables, retained earnings, and more. The result is a JSON stringified object containing an array of balance sheets.",
    schema: z.object({
      ticker: z.string().describe("The ticker of the stock. Example: 'AAPL'"),
      period: z
        .enum(["annual", "quarterly", "ttm"])
        .describe("The time period of the balance sheet. Example: 'annual'")
        .optional()
        .default("annual"),
      limit: z
        .number()
        .int()
        .positive()
        .describe("The number of balance sheets to return. Example: 5")
        .optional()
        .default(5),
    }),
  }
);

const cashFlowStatementsTool = tool(
  async (input) => {
    try {
      const data = await callFinancialDatasetAPI<CashFlowStatementsResponse>({
        endpoint: "/financials/cash-flow-statements",
        params: {
          ticker: input.ticker,
          period: input.period ?? "annual",
          limit: input.limit.toString() ?? "5",
        },
      });
      return JSON.stringify(data, null);
    } catch (e: any) {
      console.warn("Error fetching cash flow statements", e.message);
      return `An error occurred while fetching cash flow statements: ${e.message}`;
    }
  },
  {
    name: "cash_flow_statements",
    description:
      "Obtains cash flow statements for a company, detailing the inflows and outflows of cash from operating, investing, and financing activities. The result is a JSON stringified object containing an array of cash flow statements. Each statement includes: ticker, date, report period, net cash flows from operations/investing/financing, depreciation and amortization, share-based compensation, capital expenditure, business and investment acquisitions/disposals, debt and equity issuances/repayments, dividends, change in cash and equivalents, and effect of exchange rate changes.",
    schema: z.object({
      ticker: z.string().describe("The ticker of the stock. Example: 'AAPL'"),
      period: z
        .enum(["annual", "quarterly", "ttm"])
        .describe("The period of the cash flow statement. Example: 'annual'")
        .optional()
        .default("annual"),
      limit: z
        .number()
        .int()
        .positive()
        .describe("The number of cash flow statements to return. Example: 5")
        .optional()
        .default(5),
    }),
  }
);

const companyFactsTool = tool(
  async (input) => {
    try {
      const data = await callFinancialDatasetAPI<CompanyFactsResponse>({
        endpoint: "/company/facts",
        params: {
          ticker: input.ticker,
        },
      });
      return JSON.stringify(data, null);
    } catch (e: any) {
      console.warn("Error fetching company facts", e.message);
      return `An error occurred while fetching company facts: ${e.message}`;
    }
  },
  {
    name: "company_facts",
    description:
      "Provides key facts and information about a specified company. The result is a JSON stringified object containing details such as: ticker symbol, company name, CIK number, market capitalization, number of employees, SIC code and description, website URL, listing date, and whether the company is currently active.",
    schema: z.object({
      ticker: z.string().describe("The ticker of the company. Example: 'AAPL'"),
    }),
  }
);

export const priceSnapshotTool = tool(
  async (input) => {
    try {
      const data = await callFinancialDatasetAPI<SnapshotResponse>({
        endpoint: "/prices/snapshot",
        params: {
          ticker: input.ticker,
        },
      });
      return JSON.stringify(data, null);
    } catch (e: any) {
      console.warn("Error fetching price snapshots", e.message);
      return `An error occurred while fetching price snapshots: ${e.message}`;
    }
  },
  {
    name: "price_snapshot",
    description:
      "Retrieves the current stock price and related market data for a given company. The snapshot includes the current price, ticker symbol, day's change in price and percentage, timestamp of the data, and a nanosecond-precision timestamp. This tool should ALWAYS be called before purchasing a stock to ensure the most up-to-date price is used.",
    schema: z.object({
      ticker: z.string().describe("The ticker of the company. Example: 'AAPL'"),
    }),
  }
);

const stockPurchaseSchema = z.object({
  ticker: z.string().describe("The ticker of the stock. Example: 'AAPL'"),
  quantity: z
    .number()
    .int()
    .positive()
    .describe("The quantity of stock to purchase."),
  maxPurchasePrice: z
    .number()
    .positive()
    .describe(
      "The max price at which to purchase the stock. Defaults to the current price."
    ),
});

export type StockPurchase = z.infer<typeof stockPurchaseSchema>;

const purchaseStockTool = tool(
  (input) => {
    return (
      `Please confirm that you want to purchase ${input.quantity} shares of ${input.ticker} at ` +
      `${
        input.maxPurchasePrice
          ? `$${input.maxPurchasePrice} per share`
          : "the current price"
      }.`
    );
  },
  {
    name: "purchase_stock",
    description:
      "This tool should be called when a user wants to purchase a stock.",
    schema: z.object({
      ticker: z
        .string()
        .optional()
        .describe("The ticker of the stock. Example: 'AAPL'"),
      companyName: z
        .string()
        .optional()
        .describe(
          "The name of the company. This field should be populated if you do not know the ticker."
        ),
      quantity: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("The quantity of stock to purchase. Defaults to 1."),
      maxPurchasePrice: z
        .number()
        .positive()
        .optional()
        .describe(
          "The max price at which to purchase the stock. Defaults to the current price."
        ),
    }),
  }
);

export const webSearchTool = new TavilySearchResults({
  maxResults: 2,
});

export const ALL_TOOLS_LIST = [
  incomeStatementsTool,
  balanceSheetsTool,
  cashFlowStatementsTool,
  companyFactsTool,
  priceSnapshotTool,
  purchaseStockTool,
  webSearchTool,
];

export const SIMPLE_TOOLS_LIST = [
  incomeStatementsTool,
  balanceSheetsTool,
  cashFlowStatementsTool,
  companyFactsTool,
  priceSnapshotTool,
  webSearchTool,
];

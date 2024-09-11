# LangGraph Example

[Hosted Demo](https://assistant-ui-stockbroker.vercel.app/)

This example demonstrates how to use LangChain LangGraph with assistant-ui.

You need to set the following environment variables:

```bash
# Only required for production deployments
# LANGCHAIN_API_KEY=YOUR_API_KEY
LANGGRAPH_API_URL=https://assistant-ui-stockbroker.vercel.app/api # Or your production URL
NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID=stockbroker
```

To run the example, run the following commands:

```sh
npm install
npm run dev
```
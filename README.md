# veriq-sdk

Official Node.js SDK for the [Veriq](https://veriq.ecolyt.ai) API (beta): search, extract,
map, and crawl the web for AI agents and RAG pipelines.

```bash
npm install veriq-sdk
```

```ts
import { VeriqClient } from "veriq-sdk";

const client = new VeriqClient({ apiKey: process.env.VERIQ_API_KEY! });

const response = await client.search("what is retrieval augmented generation", {
  include_answer: true,
  max_results: 5,
});
console.log(response.answer);
```

Requires Node.js 20 or later. Keep your API key on the server; never ship it in browser code.

Documentation: https://veriq.ecolyt.ai/docs/

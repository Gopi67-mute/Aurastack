import type { LearningTopic, TopicContent } from "../types/learning";

interface TopicSeed {
  title: string;
  content: TopicContent;
}

function buildTopics(
  projectId: string,
  prefix: string,
  seeds: readonly TopicSeed[],
  completedCount: number,
): LearningTopic[] {
  return seeds.map(({ title, content }, index) => ({
    id: `${prefix}-${index + 1}`,
    projectId,
    title,
    description: content.what,
    order: index + 1,
    status: index < completedCount ? "completed" : "not_started",
    content,
  }));
}

const ECOMMERCE_TOPICS: readonly TopicSeed[] = [
  {
    title: "React Native fundamentals",
    content: {
      what: "The core building blocks of React Native: components, props, state and native views.",
      why: "Every screen of the store, from product lists to checkout, is built from these primitives.",
      how: "Components return a tree of native views. Props flow down, state lives in hooks, and re-renders update only what changed.",
      example: "A ProductCard component receives a product prop and renders an image, title and price.",
      apply: "The catalog, cart and order screens are all composed from reusable typed components.",
      miniTask: "Build a ProductCard that accepts name, price and image props.",
    },
  },
  {
    title: "Expo Router navigation",
    content: {
      what: "File-based routing where each file in app/ becomes a screen and folders define navigation structure.",
      why: "Shoppers move between catalog, product detail, cart and checkout, so navigation must be predictable.",
      how: "Files map to URLs, brackets declare dynamic params, and layouts wrap groups of screens with tabs or stacks.",
      example: "app/products/[productId].tsx opens the detail screen for whichever product id is in the URL.",
      apply: "The store uses tabs for the main areas and a stack for product detail and checkout.",
      miniTask: "Add a dynamic product detail route that reads its id param.",
    },
  },
  {
    title: "State management with Zustand",
    content: {
      what: "A small store library for sharing client state between components without prop drilling.",
      why: "The cart must be readable from the header badge, the product screen and checkout at once.",
      how: "You define a store with state and actions, and components subscribe to just the slices they need.",
      example: "useCartStore exposes items and addItem; the header badge subscribes to items.length only.",
      apply: "Cart contents and recent searches live in Zustand; server data stays the source of truth.",
      miniTask: "Create a cart store with add and remove actions.",
    },
  },
  {
    title: "REST API design",
    content: {
      what: "Designing resource-based HTTP endpoints with consistent verbs, status codes and response shapes.",
      why: "The app and backend communicate only through the API, so a clean contract prevents bugs.",
      how: "Resources are nouns, verbs map to actions, and every response uses one predictable envelope.",
      example: "GET /api/v1/products lists products; POST /api/v1/orders creates an order.",
      apply: "Products, cart and orders each get versioned endpoints with validated request bodies.",
      miniTask: "Sketch the endpoints for products and orders with their status codes.",
    },
  },
  {
    title: "MongoDB data modeling",
    content: {
      what: "Structuring documents and collections so the data matches how the app reads it.",
      why: "Products, users and orders have different access patterns, and a poor model slows every query.",
      how: "Embed data that is read together, reference data that grows or is shared, and keep one collection per concept.",
      example: "An order embeds its line items but references the user by id.",
      apply: "The store keeps separate users, products and orders collections with referenced ids.",
      miniTask: "Draft the order document, deciding what to embed and what to reference.",
    },
  },
  {
    title: "Authentication with Clerk",
    content: {
      what: "Delegating sign-up, sign-in and sessions to Clerk instead of building custom auth.",
      why: "Orders and carts belong to users, and hand-built auth is a common source of security bugs.",
      how: "Clerk handles the UI and issues a session token; the backend verifies the token on every request.",
      example: "The app sends the Clerk token in the Authorization header and the API resolves the user from it.",
      apply: "Only signed-in users can place orders, and each order is tied to the verified user id.",
      miniTask: "List which store endpoints must require a verified user.",
    },
  },
  {
    title: "Cart and checkout flows",
    content: {
      what: "Modeling the steps from adding an item to confirming an order.",
      why: "Checkout is where revenue happens, so every step needs clear loading, error and success states.",
      how: "Keep the cart client-side, validate it on the server at checkout, and only then create the order.",
      example: "Checkout re-prices each item on the server so a stale client price cannot be used.",
      apply: "The store validates stock and prices server-side before confirming any order.",
      miniTask: "Write the checkout steps as a state diagram: cart, review, pay, done.",
    },
  },
  {
    title: "Payment integration",
    content: {
      what: "Charging customers through a payment provider without handling raw card data yourself.",
      why: "The store needs to take payments safely while staying out of PCI-heavy scope.",
      how: "The client collects payment through the provider SDK, and the server confirms the result through a signed webhook.",
      example: "The server creates a payment intent; the app confirms it; a webhook marks the order paid.",
      apply: "Orders move to paid only after the provider webhook is verified, never on client say-so.",
      miniTask: "Describe the order status changes triggered by a successful and a failed payment.",
    },
  },
  {
    title: "Database Indexing",
    content: {
      what: "Indexes are extra data structures that let the database find documents without scanning a whole collection.",
      why: "Product search and order history slow down noticeably as data grows unless the right fields are indexed.",
      how: "An index stores sorted field values pointing to documents. Queries on indexed fields use it, at the cost of slightly slower writes and more storage.",
      example: "An index on orders.userId makes 'show my orders' fast; a text index on products.name powers search.",
      apply: "The store indexes products by category and name, and orders by userId and createdAt.",
      miniTask: "Pick the two most-queried fields in the orders collection and decide which to index.",
    },
  },
  {
    title: "Deployment with EAS",
    content: {
      what: "Building and shipping the app to app stores with Expo Application Services.",
      why: "The store only creates value once real users can install it.",
      how: "EAS Build produces signed binaries in the cloud, and EAS Submit uploads them to the stores.",
      example: "eas build --profile production creates the release build for both platforms.",
      apply: "Separate development, preview and production profiles keep test and live environments apart.",
      miniTask: "Define development and production build profiles in eas.json.",
    },
  },
];

const AI_CHAT_TOPICS: readonly TopicSeed[] = [
  {
    title: "FastAPI basics",
    content: {
      what: "A modern Python framework for building typed, high-performance HTTP APIs.",
      why: "The chat backend receives messages, calls the AI model and returns structured replies.",
      how: "You declare routes with decorators, and FastAPI validates inputs and generates documentation from type hints.",
      example: "A POST /chat route accepts a typed message body and returns a typed reply.",
      apply: "Thin routers call services that orchestrate the AI and persistence layers.",
      miniTask: "Create a health-check route and a POST /chat route that echoes its input.",
    },
  },
  {
    title: "Async Python",
    content: {
      what: "Using async/await so one process can wait on many slow operations at once.",
      why: "Model calls and database reads are slow, and blocking the event loop stalls every user.",
      how: "Awaiting hands control back to the event loop, which runs other requests until the awaited work is ready.",
      example: "await collection.find_one(...) frees the server to handle other chats meanwhile.",
      apply: "All database and AI calls in the chat backend are awaited, never blocking.",
      miniTask: "Convert a blocking function to async and explain what changes under load.",
    },
  },
  {
    title: "Pydantic validation",
    content: {
      what: "Defining data models whose types are checked and coerced automatically.",
      why: "Every request and every AI reply must be validated before it is trusted or stored.",
      how: "A model declares fields and types; invalid data raises a clear error instead of flowing on.",
      example: "A ChatRequest model requires a non-empty message string of limited length.",
      apply: "Requests, AI responses and stored documents each have their own schema.",
      miniTask: "Write a ChatRequest schema with a length-limited message field.",
    },
  },
  {
    title: "Prompt design",
    content: {
      what: "Writing instructions and context that steer the model toward useful, consistent answers.",
      why: "Answer quality depends more on the prompt and context than on any other single factor.",
      how: "State the role, the task and constraints, then supply relevant context and examples of the expected output.",
      example: "A system prompt sets the assistant role, tone and output format before the user message.",
      apply: "The chat app builds each prompt from the system role, project context and recent messages.",
      miniTask: "Draft a system prompt that fixes the assistant role and answer format.",
    },
  },
  {
    title: "JWT Authentication",
    content: {
      what: "JSON Web Tokens are signed tokens that prove who a caller is without a server-side session lookup.",
      why: "Chats are private, so the API must know exactly which user each request comes from.",
      how: "The client sends a signed token; the server checks the signature, expiry, issuer and audience before trusting any claim.",
      example: "The API verifies the Clerk-issued JWT, then reads the user id claim to load only that user's chats.",
      apply: "Every chat endpoint verifies the token and confirms the conversation belongs to that user.",
      miniTask: "List the four checks the server must perform on an incoming token.",
    },
  },
  {
    title: "Structured JSON outputs",
    content: {
      what: "Having the model reply in a fixed JSON shape instead of free text.",
      why: "The app renders replies as UI, so it needs predictable fields, not prose to parse.",
      how: "Ask for a schema in the prompt, parse the reply, and validate it before use.",
      example: "The reply has summary, steps and warnings fields; anything malformed is rejected and retried.",
      apply: "Validated replies are normalized and stored, so the app only ever sees typed data.",
      miniTask: "Define a Pydantic model for a reply with summary and next steps.",
    },
  },
  {
    title: "Conversation memory",
    content: {
      what: "Giving the model earlier messages so replies stay consistent across a conversation.",
      why: "Without memory every message is answered as if it were the first.",
      how: "Store messages per conversation and include a bounded window of recent ones in each prompt.",
      example: "The last ten messages are loaded from MongoDB and added to the prompt.",
      apply: "Messages are stored per conversation, indexed by conversation id and time.",
      miniTask: "Decide how many past messages to include and what happens beyond that.",
    },
  },
  {
    title: "Streaming responses",
    content: {
      what: "Sending the model reply to the client in pieces as it is generated.",
      why: "Long answers feel much faster when text appears immediately.",
      how: "The server yields chunks over a streaming response and the client appends them as they arrive.",
      example: "A streaming endpoint yields tokens; the chat bubble grows while the model writes.",
      apply: "The final reply is still validated and saved once the stream completes.",
      miniTask: "Explain what should happen if the stream drops halfway through.",
    },
  },
];

const CURATED_CURRICULA: Readonly<Record<string, () => LearningTopic[]>> = {
  "mock-ecommerce": () => buildTopics("mock-ecommerce", "ecommerce", ECOMMERCE_TOPICS, 8),
  "mock-ai-chat": () => buildTopics("mock-ai-chat", "ai-chat", AI_CHAT_TOPICS, 4),
};

/**
 * V1 placeholder for the future `GET /projects/{id}/learning` response: curated
 * curricula (with seeded progress) for the mock projects only. Returns
 * undefined for every other project, which then gets a generated curriculum.
 */
export function getMockCurriculum(projectId: string): LearningTopic[] | undefined {
  return CURATED_CURRICULA[projectId]?.();
}

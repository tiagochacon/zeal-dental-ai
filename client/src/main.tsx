import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, httpLink, splitLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

/**
 * DOM Protection: Monkey-patch removeChild to gracefully handle
 * "The node to be removed is not a child of this node" errors.
 * This is a well-known React issue caused by browser extensions
 * (especially translation extensions) that modify the DOM tree
 * outside of React's control. The patch catches the error and
 * removes the node from its actual parent instead.
 * See: https://github.com/facebook/react/issues/17256
 */
if (typeof Node !== 'undefined') {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      console.warn(
        '[DOM Protection] removeChild: node is not a child of this parent. ' +
        'This is likely caused by a browser extension modifying the DOM.'
      );
      // If the child has a different parent, remove it from there
      if (child.parentNode) {
        return child.parentNode.removeChild(child) as T;
      }
      // If the child has no parent at all, just return it
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      console.warn(
        '[DOM Protection] insertBefore: reference node is not a child of this parent. ' +
        'This is likely caused by a browser extension modifying the DOM.'
      );
      // Fall back to appendChild if reference node is invalid
      return this.appendChild(newNode) as T;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const createRequestId = () =>
  `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const tracedFetch: typeof globalThis.fetch = async (input, init) => {
  const requestId = createRequestId();
  const headers = new Headers(init?.headers);
  headers.set("x-request-id", requestId);
  const response = await globalThis.fetch(input, {
    ...(init ?? {}),
    credentials: "include",
    headers,
  });

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    try {
      const snippet = (await response.clone().text()).slice(0, 300);
      const safeUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : "unknown";
      console.error("[API Non-JSON Response]", {
        requestId,
        url: safeUrl,
        status: response.status,
        contentType,
        bodySnippet: snippet,
      });
    } catch (err) {
      console.error("[API Non-JSON Response] failed to read body", { requestId, err });
    }
  }

  return response;
};

const trpcClient = trpc.createClient({
  links: [
    splitLink({
      condition(op) {
        return op.path === "calls.analyzeNeurovendas";
      },
      true: httpLink({
        url: "/api/trpc",
        transformer: superjson,
        fetch: tracedFetch,
      }),
      false: httpBatchLink({
        url: "/api/trpc",
        transformer: superjson,
        fetch: tracedFetch,
      }),
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);

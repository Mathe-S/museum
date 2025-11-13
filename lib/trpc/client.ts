import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@/server";

/**
 * tRPC React client
 * Use this to make type-safe API calls from React components
 */
export const trpc = createTRPCReact<AppRouter>();

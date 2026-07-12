import { useMutation } from "@tanstack/react-query";
import type { ProxyResult } from "../lib/api.js";

// The caller supplies a task (sendProxy or sendProxyMultipart, already bound to its args), so
// one mutation covers both the JSON and multipart transports with shared pending/error state.
export const useSendRequest = () => useMutation({ mutationFn: (task: () => Promise<ProxyResult>) => task() });

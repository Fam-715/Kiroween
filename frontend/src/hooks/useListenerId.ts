import { useState } from "react";
import { getOrCreateListenerId } from "../api/listenerId";

/** Anonymous listener identity: a UUID v4 created on first visit and kept in localStorage. */
export function useListenerId(): string {
  const [listenerId] = useState<string>(getOrCreateListenerId);
  return listenerId;
}

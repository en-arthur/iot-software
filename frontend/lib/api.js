import { createClient } from "@/lib/supabase/client";

const DEFAULT_API_URL = "http://localhost:8000";

/**
 * An error returned by the FastAPI backend (or by the network layer).
 */
export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, code?: string | null, details?: unknown }} [options]
   */
  constructor(message, { status = 0, code = null, details = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * @returns {string} The FastAPI base URL without a trailing slash.
 */
export function getApiBaseUrl() {
  return (process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/+$/, "");
}

/**
 * Read the current Supabase access token. supabase-js refreshes it when
 * needed, so this is safe to call before every backend request.
 *
 * @returns {Promise<string | null>}
 */
async function getAccessToken() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new ApiError("Could not verify your session. Please sign in again.", {
      status: 401,
      code: "session_error",
    });
  }

  return data.session?.access_token ?? null;
}

/**
 * Pull a human-readable message out of common FastAPI error shapes.
 *
 * @param {unknown} payload
 * @returns {string | null}
 */
function extractDetail(payload) {
  if (!payload) return null;
  if (typeof payload === "string") return payload;
  if (typeof payload !== "object") return null;

  if (typeof payload.detail === "string") return payload.detail;

  if (Array.isArray(payload.detail)) {
    const messages = payload.detail
      .map((item) => (typeof item === "string" ? item : item?.msg))
      .filter(Boolean);
    if (messages.length > 0) return messages.join(" ");
  }

  if (typeof payload.message === "string") return payload.message;
  if (typeof payload.error === "string") return payload.error;

  return null;
}

/**
 * Map an HTTP failure to a clear user-facing message.
 *
 * Assumption: 403 means the board is not owned by the current user and 409
 * means the board is offline. Backend details that explicitly mention
 * "offline" or "not your board" take precedence over these fallbacks.
 *
 * @param {number} status
 * @param {unknown} payload
 * @param {{ conflictMessage?: string, forbiddenMessage?: string }} [fallbacks]
 * @returns {string}
 */
function messageForStatus(
  status,
  payload,
  { conflictMessage = "Board is offline", forbiddenMessage = "Not your board" } = {}
) {
  const detail = extractDetail(payload);

  if (detail) {
    if (/offline/i.test(detail)) return "Board is offline";
    if (/not your board|not the owner|not owned|forbidden/i.test(detail)) {
      return forbiddenMessage;
    }
    if (/already claimed|already owned|claimed by/i.test(detail)) {
      return "This board has already been claimed.";
    }
    if (status === 409 && /^(conflict|already exists)$/i.test(detail)) {
      return conflictMessage;
    }
    return detail;
  }

  switch (status) {
    case 400:
      return "That request was invalid.";
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return forbiddenMessage;
    case 404:
      return "Board not found";
    case 409:
      return conflictMessage;
    case 422:
      return "The request was rejected. Check the board ID and relay number.";
    case 429:
      return "Too many requests. Please wait a moment and try again.";
    case 500:
    case 502:
    case 503:
    case 504:
      return "The server is unavailable right now. Please try again.";
    default:
      return `Request failed (${status}).`;
  }
}

/**
 * Small fetch wrapper for the FastAPI backend.
 *
 * @param {string} path
 * @param {{
 *   method?: string,
 *   body?: unknown,
 *   signal?: AbortSignal,
 *   conflictMessage?: string,
 *   forbiddenMessage?: string,
 * }} [options]
 * @returns {Promise<unknown>}
 */
async function request(
  path,
  {
    method = "GET",
    body,
    signal,
    conflictMessage = "Board is offline",
    forbiddenMessage = "Not your board",
  } = {}
) {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new ApiError("Your session has expired. Please sign in again.", {
      status: 401,
      code: "unauthorized",
    });
  }

  /** @type {Record<string, string>} */
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new ApiError(
      "Can't reach the server. Check that the FastAPI backend is running and try again.",
      { code: "network_error" }
    );
  }

  const rawBody = await response.text();
  let payload = null;

  if (rawBody) {
    try {
      payload = JSON.parse(rawBody);
    } catch {
      payload = rawBody;
    }
  }

  if (!response.ok) {
    throw new ApiError(
      messageForStatus(response.status, payload, { conflictMessage, forbiddenMessage }),
      {
        status: response.status,
        code: payload && typeof payload === "object" ? payload.code : null,
        details: payload,
      }
    );
  }

  return payload;
}

/**
 * Send a relay command. The backend returns 202 Accepted; the UI must wait
 * for a Realtime relay_states event before treating the new state as real.
 *
 * @param {string} boardId
 * @param {number} relayNumber
 * @param {"on" | "off"} state
 * @returns {Promise<unknown>}
 */
export async function sendRelayCommand(boardId, relayNumber, state) {
  if (state !== "on" && state !== "off") {
    throw new ApiError("Invalid relay state.", { status: 400, code: "invalid_state" });
  }

  return request(
    `/boards/${encodeURIComponent(boardId)}/relays/${encodeURIComponent(relayNumber)}`,
    {
      method: "POST",
      body: { state },
    }
  );
}

/**
 * Claim an unowned board for the signed-in user.
 *
 * @param {string} boardId
 * @returns {Promise<unknown>}
 */
export async function claimBoard(boardId) {
  const trimmedBoardId = boardId.trim();

  if (!trimmedBoardId) {
    throw new ApiError("Enter a board ID.", { status: 400, code: "missing_board_id" });
  }

  return request("/boards/claim", {
    method: "POST",
    body: { board_id: trimmedBoardId },
    conflictMessage: "This board has already been claimed.",
    forbiddenMessage: "You can't claim this board.",
  });
}

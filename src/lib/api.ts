/**
 * API Client — The ONLY file that talks to the backend.
 *
 * HOW IT WORKS:
 * Browser → Go Gateway (port 8080) → Python Backend (port 8000)
 *
 * The Go gateway validates the JWT token, extracts the user_id,
 * then forwards the request to Python with an X-User-ID header.
 *
 * FORMAT ROUTING:
 * AP matches → /api/v1/ap/matches
 * BP matches → /api/v1/bp/matches
 * The format is part of the URL path, not the request body.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

// ============================================================================
// TYPES — These must match the Python Pydantic schemas EXACTLY
// ============================================================================

/** AP roles (6 speakers). Maps to src/schemas/ap/matches.py → APRole */
export type APRole =
  | "prime_minister"
  | "leader_of_opposition"
  | "deputy_prime_minister"
  | "deputy_leader_of_opposition"
  | "government_whip"
  | "opposition_whip";

/** BP roles (8 speakers). Maps to src/schemas/bp/matches.py → BPRole */
export type BPRole =
  | APRole
  | "member_of_government"
  | "member_of_opposition";

export type DebateFormat = "ap" | "bp";
export type DebateSide = "government" | "opposition";

/**
 * Maps every role to its side.
 * This is derived from the schedule in src/engine/state.py.
 * When user picks a role, we auto-determine the side from this map.
 */
export const ROLE_TO_SIDE: Record<string, DebateSide> = {
  prime_minister: "government",
  deputy_prime_minister: "government",
  member_of_government: "government",
  government_whip: "government",
  leader_of_opposition: "opposition",
  deputy_leader_of_opposition: "opposition",
  member_of_opposition: "opposition",
  opposition_whip: "opposition",
};

/** Human-readable labels for roles */
export const ROLE_LABELS: Record<string, string> = {
  prime_minister: "Prime Minister",
  leader_of_opposition: "Leader of Opposition",
  deputy_prime_minister: "Deputy Prime Minister",
  deputy_leader_of_opposition: "Deputy Leader of Opposition",
  member_of_government: "Member of Government",
  member_of_opposition: "Member of Opposition",
  government_whip: "Government Whip",
  opposition_whip: "Opposition Whip",
};

/** Which roles are available for each format */
export const FORMAT_ROLES: Record<DebateFormat, string[]> = {
  ap: [
    "prime_minister",
    "leader_of_opposition",
    "deputy_prime_minister",
    "deputy_leader_of_opposition",
    "government_whip",
    "opposition_whip",
  ],
  bp: [
    "prime_minister",
    "leader_of_opposition",
    "deputy_prime_minister",
    "deputy_leader_of_opposition",
    "member_of_government",
    "member_of_opposition",
    "government_whip",
    "opposition_whip",
  ],
};

// ============================================================================
// MATCH CREATION
// ============================================================================

/**
 * What we send to the backend.
 * Must match: src/schemas/ap/matches.py → CreateMatchRequest
 *
 * Key difference from old code:
 * - OLD: { motion_text, side, format, skill_level }  ← WRONG
 * - NEW: { motion, side, role }                       ← CORRECT
 *
 * The format (ap/bp) goes in the URL, not the body.
 * The side is derived from the role on the backend too,
 * but we send it explicitly for the CasePrep record.
 */
interface CreateMatchPayload {
  motion: string;
  side: DebateSide;
  role: string;
}

interface CreateMatchResponse {
  session_id: string;
  case_prep_id: string;
  message: string;
}

/**
 * Create a new debate match.
 *
 * FLOW: Frontend → Go Gateway → Python Backend
 * URL:  POST /api/v1/{format}/matches
 *
 * The Go gateway sees /api/* and forwards to Python backend (port 8000).
 * Python creates: Motion → CasePrep → DebateSession in PostgreSQL,
 * then initializes the Redis state with the speaker schedule.
 */
export async function createMatch(
  format: DebateFormat,
  payload: CreateMatchPayload,
  token: string
): Promise<CreateMatchResponse> {
  const res = await fetch(`${API_BASE}/api/v1/${format}/matches`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || error.message || "Failed to create match");
  }

  return res.json();
}

// ============================================================================
// CASE PREP
// ============================================================================

export interface CasePrepData {
  id: string;
  side: string;
  arguments: Array<{ claim: string; warrant?: string; impact?: string }>;
  counter_arguments: string[];
  evidence: string[];
}

/**
 * Fetch AI-generated case preparation for a match.
 *
 * URL: GET /api/v1/{format}/matches/{matchId}/case-prep
 *
 * This is called after match creation — the AI has already generated
 * arguments, counter-arguments, and evidence that the user reviews
 * before entering the live arena.
 */
export async function getCasePrep(
  format: DebateFormat,
  matchId: string,
  token: string
): Promise<CasePrepData> {
  const res = await fetch(
    `${API_BASE}/api/v1/${format}/matches/${matchId}/case-prep`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Case prep not found");
  }

  return res.json();
}

// ============================================================================
// DEBATE RESULTS
// ============================================================================

/**
 * Fetch debate results (scores, clash analysis, feedback).
 *
 * URL: GET /api/v1/debates/{sessionId}/results
 *
 * Called after a match completes. The adjudication agent scores
 * each speaker on content, strategy, style, structure, and POI handling.
 */
export async function getDebateResults(sessionId: string, token: string) {
  const res = await fetch(`${API_BASE}/api/v1/debates/${sessionId}/results`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok)
    throw new Error(
      "Results not available yet. Match may still be processing."
    );
  return res.json();
}

// ============================================================================
// MATCH HISTORY
// ============================================================================

/**
 * Fetch user's match history for a specific format.
 *
 * URL: GET /api/v1/{format}/matches?skip=0&limit=20
 *
 * The backend filters by format automatically because AP and BP
 * have separate route namespaces.
 */
export async function getMatchHistory(
  format: DebateFormat,
  token: string,
  skip = 0,
  limit = 20
) {
  const res = await fetch(
    `${API_BASE}/api/v1/${format}/matches?skip=${skip}&limit=${limit}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) throw new Error("Failed to fetch match history");
  return res.json();
}
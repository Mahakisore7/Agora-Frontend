const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface CreateMatchPayload {
  motion_text: string;
  side: "government" | "opposition";
  format: "ap" | "bp";
  skill_level: "beginner" | "intermediate" | "advanced";
}

interface CreateMatchResponse {
  session_id: string;
  case_prep_id: string;   
  message: string;        
}

export async function createMatch(
  payload: CreateMatchPayload,
  token: string
): Promise<CreateMatchResponse> {
  const res = await fetch(`${API_BASE}/api/v1/matches`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "Failed to create match");
  }

  return res.json();
}

export async function getDebateResults(sessionId: string, token: string) {
  const res = await fetch(`${API_BASE}/api/v1/debates/${sessionId}/results`, {
    headers: { "Authorization": `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Results not available yet. Match may still be processing.");
  return res.json();
}


export interface CasePrepData {
  id: string;
  side: string;
  arguments: Array<{ claim: string; warrant?: string; impact?: string }>;
  counter_arguments: string[];
  evidence: string[];
}

export async function getCasePrep(
  matchId: string,
  token: string
): Promise<CasePrepData> {
  const res = await fetch(`${API_BASE}/api/v1/matches/${matchId}/prep`, {
    headers: { "Authorization": `Bearer ${token}` },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Case prep not found");
  }

  return res.json();
}
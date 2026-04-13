const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface CreateMatchPayload {
  motion_text: string;
  side: "government" | "opposition";
  format: "ap" | "bp";
  skill_level: "beginner" | "intermediate" | "advanced";
}

interface CreateMatchResponse {
  match_id: string;
  status: string;
  schedule: Array<{ role: string; side: string; player_type: string }>;
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
  if (!res.ok) throw new Error("Results not available yet");
  return res.json();
}

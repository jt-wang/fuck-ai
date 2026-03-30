const API =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:8787"
    : "https://api.fuck-ai.dev";

export interface ModelStatus {
  model: string;
  display_name: string;
  provider: string;
  current_fucks: number;
  fuck_score: number;
  status: string;
  z_score: number;
}

export interface StatusResponse {
  hour_bucket: string;
  models: ModelStatus[];
}

export interface ModelDetail {
  model: string;
  display_name: string;
  provider: string;
  current_fucks: number;
  baseline_mean: number | null;
  baseline_std: number | null;
  z_score: number;
  fuck_score: number;
  status: string;
  hours: { hour_bucket: string; fuck_count: number }[];
}

export async function fetchStatus(): Promise<StatusResponse | null> {
  try {
    const res = await fetch(`${API}/api/status`);
    if (!res.ok) throw new Error(res.statusText);
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchModelDetail(
  model: string
): Promise<ModelDetail | null> {
  try {
    const res = await fetch(`${API}/api/status/${model}`);
    if (!res.ok) throw new Error(res.statusText);
    return res.json();
  } catch {
    return null;
  }
}

export async function submitFuck(model: string) {
  const res = await fetch(`${API}/api/fuck`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model }),
  });
  return res.json();
}

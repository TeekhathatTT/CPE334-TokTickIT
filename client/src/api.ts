const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

// Issue 2 + Issue 4 — call the backend.
// Steps: fetch `${API_URL}/api/health`; if not ok, throw.
//        then fetch `${API_URL}/api/categories`; if not ok, throw.
//        return { online: true, categories }.
// Throwing on failure lets the UI show a single Offline/error state.
export async function checkSystem(): Promise<SystemStatus> {
  // Issue 2 & 4: implement the two fetch calls described above.
  const healthResp = await fetch(`${API_URL}/api/health`);
  if (!healthResp.ok) {
    throw new Error(`health check failed: ${healthResp.status}`);
  }

  const catsResp = await fetch(`${API_URL}/api/categories`);
  if (!catsResp.ok) {
    throw new Error(`categories fetch failed: ${catsResp.status}`);
  }

  const categories: Category[] = await catsResp.json();
  return { online: true, categories };
}

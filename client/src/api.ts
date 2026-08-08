const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

export async function checkSystem(): Promise<SystemStatus> {
  const healthRes = await fetch(`${API_URL}/api/health`);

  if (!healthRes.ok) {
    throw new Error(`Health check failed: ${healthRes.status}`);
  }

  return {
    online: true,
    categories: [],
  };
}
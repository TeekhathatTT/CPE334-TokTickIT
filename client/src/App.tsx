import { useState } from "react";
import { checkSystem, Category } from "./api";

// UI states you must handle for Issue 4: idle, loading, success, error.
type UiState = "idle" | "loading" | "success" | "error";

export default function App() {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);

  async function handleCheck() {
    setState("loading");
    try {
      const result = await checkSystem();
      setCategories(result.categories ?? []);
      setState("success");
    } catch (err) {
      setState("error");
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-4">
        TokTickIT <span className="text-success">IT Service Desk</span>
      </h1>

      <button type="button" className="btn btn-success" onClick={handleCheck} disabled={state === "loading"}>
        {state === "loading" ? "Loading…" : "Check System"}
      </button>

      <div className="mt-4">
        {state === "loading" && <div>Loading…</div>}

        {state === "success" && (
          <div>
            <h2>System Status: <span className="text-success">Online</span></h2>
            {categories.length > 0 ? (
              <ul>
                {categories.map((c) => (
                  <li key={c.id}>{c.name}</li>
                ))}
              </ul>
            ) : (
              <div>No categories loaded.</div>
            )}
          </div>
        )}

        {state === "error" && (
          <div>
            <h2>System Status: <span className="text-danger">Offline</span></h2>
            <div>Unable to reach the backend API. Please ensure the server is running.</div>
          </div>
        )}
      </div>
    </div>
  );
}

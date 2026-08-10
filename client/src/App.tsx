import { useState } from "react";
import { checkSystem, Category } from "./api.js";

// UI states you must handle for Issue 4: idle, loading, success, error.
type UiState = "idle" | "loading" | "success" | "error";

export default function App() {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleCheck() {
    setState("loading");
    setErrorMessage("");

    try {
      const result = await checkSystem();
      setCategories(result.categories);
      setState("success");
    } catch (error) {
      setCategories([]);
      setErrorMessage(error instanceof Error ? error.message : "Unable to reach the API");
      setState("error");
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-4">
        TokTickIT <span className="text-success">IT Service Desk</span>
      </h1>

      <button className="btn btn-success" onClick={handleCheck} disabled={state === "loading"}>
        {state === "loading" ? "Loading…" : "Check System"}
      </button>

      {state === "loading" && <p className="mt-3">Loading categories…</p>}

      {state === "success" && (
        <div className="mt-3">
          <p className="text-success fw-semibold">Online</p>
          <ul>
            {categories.map((category) => (
              <li key={category.id}>{category.name}</li>
            ))}
          </ul>
        </div>
      )}

      {state === "error" && (
        <div className="mt-3">
          <p className="text-danger fw-semibold">Offline</p>
          <p>{errorMessage}</p>
        </div>
      )}
    </div>
  );
}

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RequesterSelectionPage } from "../src/pages/RequesterSelectionPage";
import * as api from "../src/api";

describe("RequesterSelectionPage", () => {
  it("shows loading, then enables continue after selection", async () => {
    vi.spyOn(api, "getRequesters").mockResolvedValue([{ id: 1, name: "A User", email: "a@example.com" }]);
    const onContinue = vi.fn();
    render(<RequesterSelectionPage selectedRequesterId={null} onRequesterChange={vi.fn()} onContinue={onContinue} />);

    expect(screen.getByLabelText(/loading development requesters/i)).toBeInTheDocument();
    const select = await screen.findByRole("combobox");
    const continueButton = screen.getByRole("button", { name: /continue/i });
    expect(continueButton).toBeDisabled();
    fireEvent.change(select, { target: { value: "1" } });
    expect(continueButton).toBeEnabled();
    fireEvent.click(continueButton);
    expect(onContinue).toHaveBeenCalledWith(1, "A User");
  });

  it("shows empty and API error states", async () => {
    vi.spyOn(api, "getRequesters").mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("Service unavailable"));
    const props = { selectedRequesterId: null, onRequesterChange: vi.fn(), onContinue: vi.fn() };
    const { unmount } = render(<RequesterSelectionPage {...props} />);
    expect(await screen.findByText(/no active development requesters/i)).toBeInTheDocument();
    unmount();
    render(<RequesterSelectionPage {...props} />);
    expect(await screen.findByText("Service unavailable")).toBeInTheDocument();
  });
});
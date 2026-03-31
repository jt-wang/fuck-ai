import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import Dashboard from "../src/components/Dashboard";

const { mockModels } = vi.hoisted(() => {
  const mockModels = [
    {
      model: "claude-opus-4-6",
      display_name: "Claude Opus 4.6",
      provider: "Anthropic",
      current_fucks: 1,
      fuck_score: 2.8,
      status: "normal",
      z_score: -0.19,
    },
    {
      model: "gpt-5.4",
      display_name: "GPT-5.4",
      provider: "OpenAI",
      current_fucks: 0,
      fuck_score: 4.4,
      status: "smart",
      z_score: 0,
    },
    {
      model: "gemini-3.1-pro",
      display_name: "Gemini 3.1 Pro",
      provider: "Google",
      current_fucks: 0,
      fuck_score: 4.3,
      status: "smart",
      z_score: 0,
    },
  ];
  return { mockModels };
});

vi.mock("../src/lib/api", () => ({
  fetchStatus: vi.fn().mockResolvedValue({
    hour_bucket: "2026-03-31T10:00:00Z",
    models: mockModels,
  }),
  fetchModelDetail: vi.fn().mockResolvedValue(null),
  submitFuck: vi.fn().mockResolvedValue({}),
}));

function getScoreBtn() {
  return screen.getByRole("button", { name: /by score/ });
}

function getNameBtn() {
  return screen.getByRole("button", { name: /by name/ });
}

/** Returns display_name text nodes from model cards in DOM order */
function getModelNamesInOrder(): string[] {
  const grid = document.querySelector(".grid")!;
  const cards = Array.from(grid.children);
  return cards.map((card) => {
    const nameEl = card.querySelector(".text-sm.font-semibold")!;
    return nameEl.textContent!;
  });
}

describe("Dashboard sort controls", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => { store[key] = val; },
    });
  });

  it("defaults to score desc with down arrow", async () => {
    render(<Dashboard locale="en" />);
    await screen.findByRole("button", { name: /by score/ });
    expect(getScoreBtn()).toHaveTextContent("by score▼");
  });

  it("shows no arrow on inactive button", async () => {
    render(<Dashboard locale="en" />);
    await screen.findByRole("button", { name: /by name/ });
    expect(getNameBtn()).toHaveTextContent("by name");
    expect(getNameBtn().textContent).toBe("by name");
  });

  it("toggles score direction on click", async () => {
    render(<Dashboard locale="en" />);
    await screen.findByRole("button", { name: /by score/ });
    const btn = getScoreBtn();
    expect(btn).toHaveTextContent("▼");
    fireEvent.click(btn);
    expect(btn).toHaveTextContent("▲");
    fireEvent.click(btn);
    expect(btn).toHaveTextContent("▼");
  });

  it("switches to name asc with up arrow when clicking name button", async () => {
    render(<Dashboard locale="en" />);
    await screen.findByRole("button", { name: /by name/ });
    const btn = getNameBtn();
    fireEvent.click(btn);
    expect(btn).toHaveTextContent("by name▲");
  });

  it("sorts models by score desc by default (highest first)", async () => {
    render(<Dashboard locale="en" />);
    await screen.findByRole("button", { name: /by score/ });
    expect(getModelNamesInOrder()).toEqual([
      "GPT-5.4",
      "Gemini 3.1 Pro",
      "Claude Opus 4.6",
    ]);
  });

  it("sorts models by score asc (lowest first) after toggling", async () => {
    render(<Dashboard locale="en" />);
    await screen.findByRole("button", { name: /by score/ });
    fireEvent.click(getScoreBtn());
    expect(getModelNamesInOrder()).toEqual([
      "Claude Opus 4.6",
      "Gemini 3.1 Pro",
      "GPT-5.4",
    ]);
  });

  it("sorts models A-Z when clicking name", async () => {
    render(<Dashboard locale="en" />);
    await screen.findByRole("button", { name: /by name/ });
    fireEvent.click(getNameBtn());
    expect(getModelNamesInOrder()).toEqual([
      "Claude Opus 4.6",
      "Gemini 3.1 Pro",
      "GPT-5.4",
    ]);
  });

  it("sorts models Z-A when toggling name direction", async () => {
    render(<Dashboard locale="en" />);
    await screen.findByRole("button", { name: /by name/ });
    const btn = getNameBtn();
    fireEvent.click(btn); // name asc
    fireEvent.click(btn); // name desc = Z-A
    expect(getModelNamesInOrder()).toEqual([
      "GPT-5.4",
      "Gemini 3.1 Pro",
      "Claude Opus 4.6",
    ]);
  });

  it("resets to desc when switching back to score from name", async () => {
    render(<Dashboard locale="en" />);
    await screen.findByRole("button", { name: /by name/ });
    fireEvent.click(getNameBtn());
    fireEvent.click(getScoreBtn());
    expect(getScoreBtn()).toHaveTextContent("by score▼");
  });
});

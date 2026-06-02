import { Message, InvestorState, Scorecard } from "./gemini";

export interface SavedPitchSession {
  id: string;
  timestamp: string;
  startupProfile: {
    name: string;
    oneLiner: string;
    industry: string;
    stage: string;
    fundingGoal: string;
    pitchDeckText: string;
  };
  conversation: Message[];
  metricsLedger: Record<string, string>;
  investorStates: {
    sarah: InvestorState;
    elena: InvestorState;
    dave: InvestorState;
  };
  scorecard: Scorecard | null;
  engine: "gemini" | "ollama";
  modelName?: string;
}

const HISTORY_KEY = "pitch_arena_history";

export function getSavedSessions(): SavedPitchSession[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Failed to read pitch history from localStorage:", error);
    return [];
  }
}

export function savePitchSession(sessionData: Omit<SavedPitchSession, "id" | "timestamp">): SavedPitchSession {
  const sessions = getSavedSessions();
  
  const newSession: SavedPitchSession = {
    ...sessionData,
    id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    timestamp: new Date().toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };

  sessions.unshift(newSession); // Prepend so latest is first
  
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error("Failed to save pitch history to localStorage:", error);
  }

  return newSession;
}

export function deleteSavedSession(id: string): SavedPitchSession[] {
  const sessions = getSavedSessions();
  const updated = sessions.filter((s) => s.id !== id);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Failed to delete pitch session from localStorage:", error);
  }
  return updated;
}

export function clearSavedSessions(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch (error) {
    console.error("Failed to clear pitch history from localStorage:", error);
  }
}

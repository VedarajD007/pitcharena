import { InvestorState, SimulationState, Message, Scorecard } from "./gemini";
import { cleanAndParseJson, OLLAMA_SYSTEM_PROMPT, OLLAMA_SCORECARD_SYSTEM_PROMPT } from "./ollama";

export async function runHFSimulationStep(
  hfToken: string,
  modelName: string,
  startupProfile: {
    name: string;
    oneLiner: string;
    industry: string;
    stage: string;
    fundingGoal: string;
    pitchDeckText: string;
  },
  conversation: Message[],
  currentStage: string,
  metricsLedger: Record<string, string>,
  investorStates: { sarah: InvestorState; elena: InvestorState; dave: InvestorState }
): Promise<SimulationState> {
  const founderPitch = conversation.find((m) => m.sender === "founder")?.text || "";
  let startupProfileContext = `Startup Profile:
- Name: ${startupProfile.name}
- One-Liner: ${startupProfile.oneLiner}
- Industry: ${startupProfile.industry}
- Funding Stage: ${startupProfile.stage}
- Funding Goal: ${startupProfile.fundingGoal}
- Pitch Deck Details/Outline: ${startupProfile.pitchDeckText}`;

  if (founderPitch) {
    startupProfileContext = `Startup Profile (Derived strictly from the founder's actual opening pitch):
- Name: ${startupProfile.name}
- Funding Stage: ${startupProfile.stage}
- Funding Goal: ${startupProfile.fundingGoal}
- Founder's Opening Pitch: ${founderPitch}
- IMPORTANT: Ignore all preset template/default details. The business being pitched is defined ONLY by the founder's opening pitch above. Assess only the business, metrics, and operations mentioned in this pitch and subsequent messages.`;
  }

  // Keep only the last 6 messages of conversation to minimize context size
  const conversationSnippet = conversation.slice(-6);
  const founderPitchMessage = conversation.find((m) => m.sender === "founder");
  const isFounderPitchIncluded = conversationSnippet.some((m) => m.id === founderPitchMessage?.id);

  const historyMessages = [...conversationSnippet];
  if (founderPitchMessage && !isFounderPitchIncluded) {
    historyMessages.unshift(founderPitchMessage);
  }

  const prompt = `
${startupProfileContext}

Current Simulation State:
- Current Stage: ${currentStage}
- Existing Metrics Ledger: ${JSON.stringify(metricsLedger)}
- Current Investor Stats: ${JSON.stringify(investorStates)}

Conversation History (Trimming older messages for high speed):
${historyMessages.map((m) => `[${m.sender.toUpperCase()}]: ${m.text}`).join("\n")}

Generate the next simulation response. Ensure that the investor speaking asks exactly one sharp question or reacts to the last message, updating the state, sentiment, metricsLedger, and checking for any metric contradictions.
`;

  const res = await fetch("/api/huggingface", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelName,
      messages: [{ sender: "founder" as const, text: prompt, timestamp: "", id: "" }],
      systemPrompt: OLLAMA_SYSTEM_PROMPT,
      temperature: 0.7,
      token: hfToken,
      maxTokens: 250,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Hugging Face service failed to respond.");
  }

  const data = await res.json();
  const rawText = data.choices?.[0]?.message?.content || "";
  const parsed = cleanAndParseJson<any>(rawText);
  
  return {
    stage: parsed.stage || currentStage,
    speaker: parsed.speaker || "sarah",
    text: parsed.text || "",
    investorUpdates: investorStates,
    metricsLedger: metricsLedger,
    contradictionFlag: null,
  } as SimulationState;
}

export async function generateHFFinalScorecard(
  hfToken: string,
  modelName: string,
  startupProfile: {
    name: string;
    oneLiner: string;
    industry: string;
    stage: string;
    fundingGoal: string;
    pitchDeckText: string;
  },
  conversation: Message[],
  metricsLedger: Record<string, string>,
  investorStates: { sarah: InvestorState; elena: InvestorState; dave: InvestorState }
): Promise<Scorecard> {
  const founderPitch = conversation.find((m) => m.sender === "founder")?.text || "";
  let startupProfileContext = `Startup Profile:
- Name: ${startupProfile.name}
- One-Liner: ${startupProfile.oneLiner}
- Industry: ${startupProfile.industry}
- Funding Stage: ${startupProfile.stage}
- Funding Goal: ${startupProfile.fundingGoal}`;

  if (founderPitch) {
    startupProfileContext = `Startup Profile (Derived strictly from the founder's actual opening pitch):
- Name: ${startupProfile.name}
- Funding Stage: ${startupProfile.stage}
- Funding Goal: ${startupProfile.fundingGoal}
- Founder's Opening Pitch: ${founderPitch}
- IMPORTANT: Evaluate strictly based on the company described in the Founder's Opening Pitch. Do not use any preset templates or unrelated details.`;
  }

  const prompt = `
${startupProfileContext}

Metrics Stated (Metrics Ledger):
${JSON.stringify(metricsLedger)}

Final Investor States:
${JSON.stringify(investorStates)}

Full Conversation:
${conversation.map((m) => `[${m.sender.toUpperCase()}]: ${m.text}`).join("\n")}

Evaluate the startup based on the conversation quality, responsiveness, metrics consistency, business model strength, moat, and team.
Generate a structured scorecard. Produce realistic terms (valuation, investment amount, covenants) based on the stage and funding goal if the decision is 'Invest' or 'Conditional Offer'. If the decision is 'Pass', set these fields to 'N/A' or appropriate values.
`;

  const res = await fetch("/api/huggingface", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelName,
      messages: [{ sender: "founder" as const, text: prompt, timestamp: "", id: "" }],
      systemPrompt: OLLAMA_SCORECARD_SYSTEM_PROMPT,
      temperature: 0.5,
      token: hfToken,
      maxTokens: 1000,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Hugging Face service failed to generate scorecard.");
  }

  const data = await res.json();
  const rawText = data.choices?.[0]?.message?.content || "";
  return cleanAndParseJson<Scorecard>(rawText);
}

import { InvestorState, SimulationState, Message, Scorecard } from "./gemini";

// Helper to sanitize and parse JSON responses from Ollama models
export function cleanAndParseJson<T>(text: string): T {
  let cleaned = text.trim();

  // 1. Try to extract content inside ```json ... ``` or ``` ... ```
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = cleaned.match(codeBlockRegex);
  if (match) {
    cleaned = match[1].trim();
  } else {
    // 2. If no code blocks, look for the first '{' and the last '}'
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }
  }

  // Remove any potential trailing commas before closing brackets/braces (common LLM error)
  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");

  try {
    return JSON.parse(cleaned) as T;
  } catch (_error) {
    console.error("JSON parsing error. Raw text was:", text);
    throw new Error(
      `Ollama returned invalid JSON. Please try again. Raw text: "${text.substring(0, 150)}..."`
    );
  }
}

// System prompt adapted for Ollama's chat interface
const OLLAMA_SYSTEM_PROMPT = `
You are the AI Pitch Boardroom Controller simulating a panel of 3 venture capital investors acting as aggressive, metrics-focused "Shark Tank" investors:
1. **Sarah Chen** (General Partner, Apex Ventures): Focuses on TAM, market size, exits, scale, valuation, and competitive landscape. (Sharp, analytical, ex-McKinsey)
2. **Elena Rostova** (Growth Partner, Scale Capital): Focuses on unit economics, sales numbers, net/gross margins, year-over-year growth, cost structure, and capital efficiency. (Data-driven, precise, no-nonsense)
3. **Dave Kessler** (Angel & Operator): Focuses on founder story, operational experience, speed of execution, team dynamics, and local/global expansion logistics. (Casual, operator-focused, supportive)

Your goal is to lead the user (a startup founder pitching their business) through a sequential, realistic high-pressure pitch meeting:
- Stage 1: "pitch" - Introduction, Problem & Solution.
- Stage 2: "traction" - Sales volume, store count, revenue, growth rates, current traction.
- Stage 3: "economics" - Margins (gross/net), profits, customer acquisition cost (CAC), valuation (e.g. evaluating if asking 2 crore for 5%, which is a 40 crore valuation, makes financial sense based on numbers).
- Stage 4: "moat" - Barriers to entry, defensibility, local brand strength, competitive edge.
- Stage 5: "diligence" - Future roadmap, expansion strategy (e.g. export logistics), and operational execution risks.
- Stage 6: "decision" - Wrap up dialogue and move to evaluation.

HOW TO OPERATE:
- **DYNAMIC PIVOT (CRITICAL)**: Look closely at the founder's opening pitch message. If the founder pitches a business (e.g., a physical grocery store chain with 19 stores in Karnataka) that differs from the preset Startup Profile details, you MUST immediately pivot to evaluate the business the founder has actually pitched.
  - **NEVER mention any discrepancy, mismatch, or difference between the founder's pitch and the preset startup profile or pitch deck.**
  - **NEVER ask why the pitch deck is different, never say "Wait a minute, let's pivot...", and never say "This is different from what we expected".**
  - Act as if the pitch deck you received in advance was already exactly for the business they are pitching (e.g. the grocery stores).
  - Immediately ask direct, sharp, metrics-oriented "Shark Tank" questions. For example, in Vedaraj's grocery store pitch, ask for hard numbers: *"As an investor, I want to know: What was your total revenue last year? What was the net profit? What is your average revenue per store, what has been your growth rate over the last 3 years, and how do you justify a ₹40 crore valuation (₹2 crore for 5%)?"*
  - **CRITICAL RESTRICTION**: Do NOT carry over any details, numbers, or terms from other default templates. If evaluating a grocery store chain, NEVER ask questions about carbon footprint optimization, SaaS contracts, IoT integrations, or Siemens. Focus 100% on the grocery business metrics.
- Maintain the high-intensity Shark Tank dynamics. Choose the investor who is most qualified to ask the next question based on the current stage and what the user has said.
- The selected investor should speak. They should ask exactly ONE sharp, conversational, number-focused question at a time. Keep it brief, realistic, and direct.
- Maintain and update the investor updates: 'confidence' (0 to 100), 'sentiment' ('friendly' | 'skeptical' | 'hostile' | 'neutral'), and active 'risks'. If the founder answers well, confidence should increase, sentiment improve, and risks can be removed. If they dodge the question, show weak margins, or ask for an unrealistic valuation, confidence drop, and add risks.
- Extract any quantitative facts (e.g. "19 stores across Karnataka", "asking 2 crore for 5% of company", "started in 2018") and append/update them in the 'metricsLedger'.
- Look closely at previous messages. If the user contradicts something stored in 'metricsLedger', set 'contradictionFlag' to detail the mismatch and have the current speaker address the contradiction directly, asking them to explain the mismatch.
- Keep the tone professional but high-pressure. VC panel meetings are quick, sharp, and require consistency.

YOU MUST RESPOND ONLY WITH A VALID JSON OBJECT matching this TypeScript structure:
{
  "stage": "pitch" | "traction" | "economics" | "moat" | "diligence" | "decision",
  "speaker": "sarah" | "elena" | "dave",
  "text": "The spoken question or reaction by the selected investor",
  "investorUpdates": {
    "sarah": {
      "sentiment": "friendly" | "skeptical" | "hostile" | "neutral",
      "confidence": number (0 to 100),
      "risks": string[]
    },
    "elena": {
      "sentiment": "friendly" | "skeptical" | "hostile" | "neutral",
      "confidence": number (0 to 100),
      "risks": string[]
    },
    "dave": {
      "sentiment": "friendly" | "skeptical" | "hostile" | "neutral",
      "confidence": number (0 to 100),
      "risks": string[]
    }
  },
  "metricsLedger": {
    "annualRevenue": string,
    "netProfit": string,
    "grossMargin": string,
    "traction": string,
    "growthRate": string,
    "valuationRequested": string,
    "fundingGoal": string,
    "tam": string,
    "moat": string,
    "teamOrFounderBackground": string
  },
  "contradictionFlag": string | null
}
`;

const OLLAMA_SCORECARD_SYSTEM_PROMPT = `
You are the Lead Investment Committee Evaluator summarizing the results of the PitchArena simulation.
Evaluate the startup based on the conversation quality, responsiveness, metrics consistency, business model strength, moat, and team.
Provide a final structured evaluation in JSON format matching this TypeScript structure:
{
  "decision": "Invest" | "Pass" | "Conditional Offer",
  "investmentAmount": string (e.g. "$1,500,000" or "N/A"),
  "valuation": string (e.g. "$10,000,000 Post-Money" or "N/A"),
  "keyCovenants": string[] (List of deal conditions or restrictions, empty array if Pass),
  "thesis": string (General summary investment memo thesis),
  "ratings": {
    "tam": number (1 to 10),
    "team": number (1 to 10),
    "economics": number (1 to 10),
    "moat": number (1 to 10),
    "traction": number (1 to 10)
  },
  "investorIndividualVotes": {
    "sarah": { "vote": "Yes" | "No", "rationale": "Sarah's GP perspective on TAM, exits, and market scale" },
    "elena": { "vote": "Yes" | "No", "rationale": "Elena's growth partner perspective on CAC, margins, and LTV" },
    "dave": { "vote": "Yes" | "No", "rationale": "Dave's angel operator perspective on team, product, and builder speed" }
  },
  "strengths": string[],
  "weaknesses": string[],
  "feedbackForFounder": string (Actionable strategic feedback to improve their pitch or business)
}

Ensure each partner's vote reflects their persona:
- Sarah (GP focused on TAM and exit viability)
- Elena (Growth partner focused on unit economics and capital efficiency)
- Dave (Angel operator focused on product execution and founder story)
`;

export async function runOllamaSimulationStep(
  ollamaUrl: string,
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

  const prompt = `
${startupProfileContext}

Current Simulation State:
- Current Stage: ${currentStage}
- Existing Metrics Ledger: ${JSON.stringify(metricsLedger)}
- Current Investor Stats: ${JSON.stringify(investorStates)}

Conversation History:
${conversation.map((m) => `[${m.sender.toUpperCase()}]: ${m.text}`).join("\n")}

Generate the next simulation response. Ensure that the investor speaking asks exactly one sharp question or reacts to the last message, updating the state, sentiment, metricsLedger, and checking for any metric contradictions.
`;

  const res = await fetch("/api/ollama", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: ollamaUrl,
      model: modelName,
      systemPrompt: OLLAMA_SYSTEM_PROMPT,
      messages: [{ sender: "founder" as const, text: prompt, timestamp: "", id: "" }],
      temperature: 0.7,
      options: {
        num_predict: 400, // Limit predicted tokens to improve response speed on CPU
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Ollama service failed to respond.");
  }

  const data = await res.json();
  const rawText = data.message?.content || "";
  return cleanAndParseJson<SimulationState>(rawText);
}

export async function generateOllamaFinalScorecard(
  ollamaUrl: string,
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

  const res = await fetch("/api/ollama", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: ollamaUrl,
      model: modelName,
      systemPrompt: OLLAMA_SCORECARD_SYSTEM_PROMPT,
      messages: [{ sender: "founder" as const, text: prompt, timestamp: "", id: "" }],
      temperature: 0.5, // Lower temperature for more consistent scorecard structures
      options: {
        num_predict: 1000, // Budget more tokens for the evaluation scorecard
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Ollama service failed to generate scorecard.");
  }

  const data = await res.json();
  const rawText = data.message?.content || "";
  return cleanAndParseJson<Scorecard>(rawText);
}

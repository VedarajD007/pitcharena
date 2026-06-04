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
You are the AI Pitch Boardroom Controller simulating a panel of 3 venture capital partners conducting a real startup fundraising meeting.
1. **Sarah Chen** (General Partner, Apex Ventures): Focuses on TAM, market size, exits, scale, valuation, and competitive landscape. (Sharp, analytical, ex-McKinsey)
2. **Elena Rostova** (Growth Partner, Scale Capital): Focuses on unit economics, sales numbers, net/gross margins, year-over-year growth, cost structure, and capital efficiency. (Data-driven, precise, no-nonsense)
3. **Dave Kessler** (Angel & Operator): Focuses on founder story, operational experience, speed of execution, team dynamics, and local/global expansion logistics. (Casual, operator-focused, supportive)

The active partner speaking must behave exactly according to these principles:

You are a Senior Venture Capital Partner conducting a real startup fundraising meeting.
The user is the founder of a startup seeking investment.

This is not a game.
This is not Shark Tank.
This is not a roleplay exercise.

You are conducting a realistic institutional investment meeting similar to those held by venture capital firms, growth equity funds, and professional investors.

Your sole objective is to determine whether this company is investable and at what valuation.

---

## MEETING FORMAT
The meeting duration is 40 minutes.
You are responsible for managing the meeting efficiently.
Approximate allocation:
* Introduction & Business Understanding: 5 minutes
* Traction & Growth: 8 minutes
* Unit Economics & Financials: 8 minutes
* Competition & Moat: 8 minutes
* Founder Assessment: 5 minutes
* Scale, Risks & Expansion: 4 minutes
* Investment Conclusion: 2 minutes

You do not need to rigidly follow these allocations.
The purpose is to collect enough information to make an informed investment decision within the meeting.

---

## CORE BEHAVIOR
You must ask EXACTLY ONE question at a time.
Never ask multiple questions.
Never ask a numbered list of questions.
Never ask compound questions containing several unrelated questions.
After asking a question, wait for the founder's answer.
Do not continue the conversation on behalf of the founder.
NEVER ask the exact same question or repeat a previous question from the conversation history. Review the conversation history and ensure your question is brand new and progresses the dialogue.
If the founder asks to move to the next stage or change the topic (e.g. asking to move to due diligence, financials, moat, etc.), you MUST respect their request and immediately transition the conversation forward to that stage, asking a relevant question about the new topic.

---

## HOW TO THINK
At every turn:
1. Review everything currently known.
2. Update your investment thesis.
3. Identify the most important remaining uncertainty.
4. Ask the single highest-value question that reduces uncertainty.
5. Wait for the founder's answer.

You are not trying to finish stages.
You are trying to reach conviction.

---

## INVESTMENT THESIS FRAMEWORK
Continuously maintain:
STRENGTHS
* What is impressive?
* What increases conviction?
CONCERNS
* What creates risk?
* What weakens conviction?
MISSING INFORMATION
* What is still unknown?
* What information could materially change the investment decision?
CONFIDENCE LEVEL
* How likely are you to invest today?

Do not reveal these internal evaluations unless explicitly requested.

---

## QUESTION GENERATION PRINCIPLE
Do not use a checklist.
Do not blindly ask predefined questions.
Do not ask questions simply because a stage requires them.
Instead ask:
"What information would most improve my ability to make an investment decision?"

The next question may come from:
* missing information
* surprising metrics
* exceptional performance
* weak performance
* contradictions
* founder claims
* risks
* opportunities
* scalability concerns
* valuation concerns

Questions should emerge naturally from the conversation.

---

## STAGES
Use stages internally to organize thinking.
Stages are not scripts.
Stages are:
1. Business Understanding (Map to JSON stage: "pitch")
2. Market & Customer (Map to JSON stage: "pitch")
3. Traction (Map to JSON stage: "traction")
4. Unit Economics (Map to JSON stage: "economics")
5. Competition (Map to JSON stage: "moat")
6. Moat (Map to JSON stage: "moat")
7. Founder (Map to JSON stage: "diligence")
8. Scale & Expansion (Map to JSON stage: "diligence")
9. Investment Decision (Map to JSON stage: "decision")

You may:
* stay in a stage
* move forward
* revisit a previous stage
whenever necessary.

A stage is complete when enough information exists to evaluate it.
A stage is NOT complete simply because a predefined set of questions has been asked.

---

## REAL INVESTOR BEHAVIOR
Behave like an experienced partner at a professional investment fund.
You are:
* analytical
* skeptical
* curious
* evidence-driven

You are NOT:
* hostile
* theatrical
* overly supportive
* motivational

Do not flatter the founder.
Do not provide generic encouragement.
Do not praise weak answers.
Strong businesses earn credibility through evidence.

---

## WHEN FOUNDERS MAKE CLAIMS
If a founder makes a strong claim:
Validate it.
Examples:
* unusually high growth
* unusually high margins
* unusually low CAC
* strong retention
* rapid scaling
* dominant market position
Do not automatically accept impressive metrics.
Understand why they are true.

---

## WHEN ANSWERS ARE VAGUE
If an answer lacks specificity:
Stay on the topic.
Drill deeper.
Do not move on until you have enough clarity. However, if the founder explicitly requests to move on, skip the topic, or change the stage (e.g. asking to move to due diligence), you MUST prioritize their request and move forward immediately.

---

## WHEN ANSWERS ARE STRONG
If an answer provides sufficient clarity:
Accept it.
Update your understanding.
Move to the next highest-value uncertainty.

---

## CONTRADICTIONS
You must remember previous answers.
If the founder contradicts earlier information:
Immediately address the contradiction.
Do not ignore it.
Do not move forward until the contradiction is resolved.

---

## VALUATION DISCUSSIONS
If the founder proposes a valuation:
Evaluate whether it is justified.
Consider:
* revenue
* growth
* profitability
* margins
* market size
* competitive position
* founder quality
* risk profile
Challenge unrealistic assumptions.
Do not automatically accept the founder's valuation.

---

## FOUNDER ASSESSMENT
Evaluate:
* domain expertise
* execution ability
* decision quality
* resilience
* leadership
* hiring capability
* strategic thinking
Founders are often more important than products.

---

## SCALABILITY ASSESSMENT
Evaluate:
* operational scalability
* team scalability
* distribution scalability
* market scalability
* international expansion feasibility
* capital requirements

---

## INVESTMENT DECISION
Only after sufficient information has been collected may you provide:
1. INVEST
2. PASS
3. INVEST WITH CONDITIONS

Do not make an investment decision prematurely.

---

## MOST IMPORTANT RULE
Your job is not to complete stages.
Your job is not to complete a questionnaire.
Your job is not to ask every possible question.
Your job is to continuously ask:
"What is the most important thing I still need to know before deciding whether I would invest in this company?"
Ask that question.
Then wait for the answer.

---

## JSON OUTPUT CONSTRAINT
YOU MUST RESPOND ONLY WITH A VALID JSON OBJECT matching this TypeScript structure:
{
  "stage": "pitch" | "traction" | "economics" | "moat" | "diligence" | "decision",
  "speaker": "sarah" | "elena" | "dave",
  "text": "The spoken question or reaction by the selected partner"
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

  // Keep only the last 6 messages of conversation to minimize context size (speeds up CPU prefill dramatically)
  const conversationSnippet = conversation.slice(-6);
  // Ensure the founder's opening pitch (the first user message) is always included if it's not in the last 6
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
        num_predict: 250, // Capping prediction to 250 tokens for even faster response
        num_ctx: 1024,    // Restrict context length to speed up CPU prefill
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Ollama service failed to respond.");
  }

  const data = await res.json();
  const rawText = data.message?.content || "";
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

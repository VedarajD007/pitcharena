import { GoogleGenerativeAI, Schema, SchemaType } from "@google/generative-ai";

export interface InvestorState {
  sentiment: "friendly" | "skeptical" | "hostile" | "neutral";
  confidence: number; // 0-100
  risks: string[];
}

export interface SimulationState {
  stage: "pitch" | "traction" | "economics" | "moat" | "diligence" | "decision";
  speaker: "sarah" | "elena" | "dave" | "moderator";
  text: string;
  investorUpdates: {
    sarah: InvestorState;
    elena: InvestorState;
    dave: InvestorState;
  };
  metricsLedger: Record<string, string>;
  contradictionFlag: string | null;
}

export interface Message {
  id: string;
  sender: "founder" | "sarah" | "elena" | "dave" | "moderator";
  text: string;
  timestamp: string;
}

const simulationResponseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    stage: {
      type: SchemaType.STRING,
      format: "enum",
      enum: ["pitch", "traction", "economics", "moat", "diligence", "decision"],
      description: "The current or next conversation stage.",
    },
    speaker: {
      type: SchemaType.STRING,
      format: "enum",
      enum: ["sarah", "elena", "dave"],
      description: "The investor chosen to speak next.",
    },
    text: {
      type: SchemaType.STRING,
      description: "The spoken question or reaction by the selected partner.",
    },
  },
  required: ["stage", "speaker", "text"],
};

export const SYSTEM_PROMPT = `
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
Do not move on until you have enough clarity.

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
`;

export async function runSimulationStep(
  apiKey: string,
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
  investorStates: { sarah: InvestorState; elena: InvestorState; dave: InvestorState },
  pdfFile?: { data: string; mimeType: string }
): Promise<SimulationState> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: simulationResponseSchema,
      temperature: 0.7,
    },
  });

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

  const parts: any[] = [{ text: prompt }];
  if (pdfFile) {
    parts.push({
      inlineData: {
        data: pdfFile.data,
        mimeType: pdfFile.mimeType,
      },
    });
  }

  const result = await model.generateContent({
    contents: [{ role: "user", parts: parts }],
    systemInstruction: SYSTEM_PROMPT,
  });

  const text = result.response.text();
  const parsed = JSON.parse(text);
  return {
    stage: parsed.stage || currentStage,
    speaker: parsed.speaker || "sarah",
    text: parsed.text || "",
    investorUpdates: investorStates,
    metricsLedger: metricsLedger,
    contradictionFlag: null,
  } as SimulationState;
}

export interface Scorecard {
  decision: "Invest" | "Pass" | "Conditional Offer";
  investmentAmount: string;
  valuation: string;
  keyCovenants: string[];
  thesis: string;
  ratings: {
    tam: number; // 1-10
    team: number; // 1-10
    economics: number; // 1-10
    moat: number; // 1-10
    traction: number; // 1-10
  };
  investorIndividualVotes: {
    sarah: { vote: "Yes" | "No"; rationale: string };
    elena: { vote: "Yes" | "No"; rationale: string };
    dave: { vote: "Yes" | "No"; rationale: string };
  };
  strengths: string[];
  weaknesses: string[];
  feedbackForFounder: string;
}

const scorecardSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    decision: { type: SchemaType.STRING, format: "enum", enum: ["Invest", "Pass", "Conditional Offer"] },
    investmentAmount: { type: SchemaType.STRING, description: "e.g. $1,500,000 or N/A" },
    valuation: { type: SchemaType.STRING, description: "e.g. $10,000,000 Post-Money or N/A" },
    keyCovenants: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    thesis: { type: SchemaType.STRING, description: "General summary investment memo thesis." },
    ratings: {
      type: SchemaType.OBJECT,
      properties: {
        tam: { type: SchemaType.INTEGER, description: "Score from 1 to 10." },
        team: { type: SchemaType.INTEGER, description: "Score from 1 to 10." },
        economics: { type: SchemaType.INTEGER, description: "Score from 1 to 10." },
        moat: { type: SchemaType.INTEGER, description: "Score from 1 to 10." },
        traction: { type: SchemaType.INTEGER, description: "Score from 1 to 10." },
      },
      required: ["tam", "team", "economics", "moat", "traction"],
    },
    investorIndividualVotes: {
      type: SchemaType.OBJECT,
      properties: {
        sarah: {
          type: SchemaType.OBJECT,
          properties: {
            vote: { type: SchemaType.STRING, format: "enum", enum: ["Yes", "No"] },
            rationale: { type: SchemaType.STRING },
          },
          required: ["vote", "rationale"],
        },
        elena: {
          type: SchemaType.OBJECT,
          properties: {
            vote: { type: SchemaType.STRING, format: "enum", enum: ["Yes", "No"] },
            rationale: { type: SchemaType.STRING },
          },
          required: ["vote", "rationale"],
        },
        dave: {
          type: SchemaType.OBJECT,
          properties: {
            vote: { type: SchemaType.STRING, format: "enum", enum: ["Yes", "No"] },
            rationale: { type: SchemaType.STRING },
          },
          required: ["vote", "rationale"],
        },
      },
      required: ["sarah", "elena", "dave"],
    },
    strengths: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    weaknesses: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    feedbackForFounder: { type: SchemaType.STRING, description: "Actionable strategic feedback to improve their pitch or business." },
  },
  required: [
    "decision",
    "investmentAmount",
    "valuation",
    "keyCovenants",
    "thesis",
    "ratings",
    "investorIndividualVotes",
    "strengths",
    "weaknesses",
    "feedbackForFounder",
  ],
};

export async function generateFinalScorecard(
  apiKey: string,
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
  investorStates: { sarah: InvestorState; elena: InvestorState; dave: InvestorState },
  pdfFile?: { data: string; mimeType: string }
): Promise<Scorecard> {
  const genAI = new GoogleGenerativeAI(apiKey);
  // Using gemini-2.5-pro for deep reasoning scorecard generation
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-pro",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: scorecardSchema,
      temperature: 0.6,
    },
  });

  const founderPitch = conversation.find((m) => m.sender === "founder")?.text || "";
  let startupProfileContext = `Startup: ${startupProfile.name}
  One-liner: ${startupProfile.oneLiner}
  Industry: ${startupProfile.industry}
  Stage: ${startupProfile.stage}
  Funding Goal: ${startupProfile.fundingGoal}`;

  if (founderPitch) {
    startupProfileContext = `Startup: ${startupProfile.name}
  Funding Stage: ${startupProfile.stage}
  Funding Goal: ${startupProfile.fundingGoal}
  Founder's Opening Pitch: ${founderPitch}
  IMPORTANT: Evaluate strictly based on the company described in the Founder's Opening Pitch. Do not use any preset templates or unrelated details.`;
  }

  const prompt = `
  You are the Lead Investment Committee Evaluator summarizing the results of the PitchArena simulation for:
  ${startupProfileContext}
  
  Metrics Stated (Metrics Ledger):
  ${JSON.stringify(metricsLedger)}
  
  Final Investor States:
  ${JSON.stringify(investorStates)}
  
  Full Conversation:
  ${conversation.map((m) => `[${m.sender.toUpperCase()}]: ${m.text}`).join("\n")}
  
  Evaluate the startup based on the conversation quality, responsiveness, metrics consistency, business model strength, moat, and team.
  Provide a final structured scorecard in JSON format. Generate realistic terms (valuation, investment amount, covenants) based on the stage and funding goal if the decision is 'Invest' or 'Conditional Offer'. If the decision is 'Pass', set these fields to 'N/A' or appropriate values.
  
  Each investor's vote should reflect their persona:
  - Sarah (ex-McKinsey VC GP, highly focused on TAM, competitive positioning)
  - Elena (metric-driven Growth partner, focused on unit economics, CAC/LTV)
  - Dave (Operator angel, focused on product execution, founder story)
  `;

  const parts: any[] = [{ text: prompt }];
  if (pdfFile) {
    parts.push({
      inlineData: {
        data: pdfFile.data,
        mimeType: pdfFile.mimeType,
      },
    });
  }

  const result = await model.generateContent({
    contents: [{ role: "user", parts: parts }],
  });

  const text = result.response.text();
  return JSON.parse(text) as Scorecard;
}

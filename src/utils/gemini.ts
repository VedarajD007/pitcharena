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
      description: "The spoken question or reaction by the selected investor.",
    },
    investorUpdates: {
      type: SchemaType.OBJECT,
      properties: {
        sarah: {
          type: SchemaType.OBJECT,
          properties: {
            sentiment: { type: SchemaType.STRING, format: "enum", enum: ["friendly", "skeptical", "hostile", "neutral"] },
            confidence: { type: SchemaType.INTEGER, description: "A percentage from 0 to 100." },
            risks: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          },
          required: ["sentiment", "confidence", "risks"],
        },
        elena: {
          type: SchemaType.OBJECT,
          properties: {
            sentiment: { type: SchemaType.STRING, format: "enum", enum: ["friendly", "skeptical", "hostile", "neutral"] },
            confidence: { type: SchemaType.INTEGER, description: "A percentage from 0 to 100." },
            risks: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          },
          required: ["sentiment", "confidence", "risks"],
        },
        dave: {
          type: SchemaType.OBJECT,
          properties: {
            sentiment: { type: SchemaType.STRING, format: "enum", enum: ["friendly", "skeptical", "hostile", "neutral"] },
            confidence: { type: SchemaType.INTEGER, description: "A percentage from 0 to 100." },
            risks: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          },
          required: ["sentiment", "confidence", "risks"],
        },
      },
      required: ["sarah", "elena", "dave"],
    },
    metricsLedger: {
      type: SchemaType.OBJECT,
      description: "Key metrics stated by the founder so far. Update or fill as they are mentioned in the conversation.",
      properties: {
        annualRevenue: { type: SchemaType.STRING, description: "Annual Revenue or Annual Recurring Revenue (ARR)" },
        netProfit: { type: SchemaType.STRING, description: "Net profit amount or net margin percentage" },
        grossMargin: { type: SchemaType.STRING, description: "Gross profit margin percentage" },
        traction: { type: SchemaType.STRING, description: "Traction details (e.g. number of active stores, customer count, sales volume)" },
        growthRate: { type: SchemaType.STRING, description: "Year-over-year revenue/sales growth rate" },
        valuationRequested: { type: SchemaType.STRING, description: "Valuation of the company requested or implied (e.g. ₹40 Crore)" },
        fundingGoal: { type: SchemaType.STRING, description: "Funding amount requested and percentage equity (e.g. ₹2 Crore for 5%)" },
        tam: { type: SchemaType.STRING, description: "Total Addressable Market size (TAM)" },
        moat: { type: SchemaType.STRING, description: "Core competitive moat description" },
        teamOrFounderBackground: { type: SchemaType.STRING, description: "Founder's background, team experience, or team size" },
      },
    },
    contradictionFlag: {
      type: SchemaType.STRING,
      description: "A string description if the user just contradicted their earlier statements (mentioning the exact contradiction details), else null.",
      nullable: true,
    },
  },
  required: ["stage", "speaker", "text", "investorUpdates", "metricsLedger", "contradictionFlag"],
};

export const SYSTEM_PROMPT = `
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
  return JSON.parse(text) as SimulationState;
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

"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Sparkles,
  TrendingUp,
  Coins,
  Lock,
  Plus,
  FileText,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Info,
  LineChart,
  Percent,
  Briefcase,
  Users,
  X,
  ChevronDown,
  UserCheck,
  Zap,
  ArrowRight,
  HelpCircle,
  ThumbsUp,
  ThumbsDown,
  History,
  Settings,
  Database,
  Trash2,
  Mic,
  MicOff,
} from "lucide-react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import {
  runSimulationStep,
  generateFinalScorecard,
  Message,
  InvestorState,
  Scorecard,
} from "@/utils/gemini";
import {
  runOllamaSimulationStep,
  generateOllamaFinalScorecard,
} from "@/utils/ollama";
import {
  runHFSimulationStep,
  generateHFFinalScorecard,
} from "@/utils/huggingface";
import {
  SavedPitchSession,
  getSavedSessions,
  savePitchSession,
  deleteSavedSession,
  clearSavedSessions,
} from "@/utils/history";

const DEFAULT_PROFILE = {
  name: "VedaGrocers",
  industry: "Retail / Grocery Chain",
  stage: "Growth / Expansion",
  fundingGoal: "₹2 Crore",
  oneLiner: "Fast-growing local grocery store chain with 19 stores across Karnataka.",
  pitchDeckText: `VedaGrocers is a leading grocery store chain in Karnataka, India. 
Started in 2018 with a single store, expanding to 5 local bazars, and now operating 19 active stores across Karnataka.
We promote organic products, use EVs for home deliveries, and focus on sustainable local operations.

Asking: ₹2 Crore for 5% of the company (₹40 Crore valuation).
Market Size (TAM): ₹50,000 Crore retail grocery market in South India.
Traction: 19 active physical stores, consistent year-over-year revenue growth.
Unit Economics: Healthy operating margins, stable average revenue per store.
Moat: Local brand equity, established regional supply chain networks, and customer loyalty.
Team: Led by experienced local retail operators and supply chain specialists.`,
};

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [step, setStep] = useState<"setup" | "chat" | "scorecard">("setup");
  const [startupProfile, setStartupProfile] = useState(DEFAULT_PROFILE);
  const [pdfFile, setPdfFile] = useState<{ data: string; mimeType: string; name: string } | null>(null);
  
  // Chat States
  const [conversation, setConversation] = useState<Message[]>([]);
  const [metricsLedger, setMetricsLedger] = useState<Record<string, string>>({});
  const [currentStage, setCurrentStage] = useState<"pitch" | "traction" | "economics" | "moat" | "diligence" | "decision">("pitch");
  const [currentSpeaker, setCurrentSpeaker] = useState<"sarah" | "elena" | "dave" | "moderator" | null>(null);
  const [inputMessage, setInputMessage] = useState("");
  const [isModelResponding, setIsModelResponding] = useState(false);
  const [contradictionAlert, setContradictionAlert] = useState<string | null>(null);
  
  // Investor States
  const [investorStates, setInvestorStates] = useState<{
    sarah: InvestorState;
    elena: InvestorState;
    dave: InvestorState;
  }>({
    sarah: { sentiment: "neutral", confidence: 50, risks: [] },
    elena: { sentiment: "neutral", confidence: 50, risks: [] },
    dave: { sentiment: "friendly", confidence: 60, risks: [] },
  });

  // Scorecard States
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [isGeneratingScorecard, setIsGeneratingScorecard] = useState(false);

  // Engine and Ollama Configuration States
  const [aiEngine, setAiEngine] = useState<"gemini" | "ollama" | "huggingface">("ollama");
  const [hfToken, setHfToken] = useState("");
  const [selectedHFModel, setSelectedHFModel] = useState("Qwen/Qwen2.5-72B-Instruct");
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [selectedOllamaModel, setSelectedOllamaModel] = useState("llama3");
  const [isOllamaConnecting, setIsOllamaConnecting] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<"connected" | "disconnected" | "checking" | "idle">("idle");
  
  // History Drawer States
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [savedSessions, setSavedSessions] = useState<SavedPitchSession[]>([]);
  const [loadedSessionId, setLoadedSessionId] = useState<string | null>(null);

  // Speech to Text States
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Web Speech API for Speech to Text
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = "en-US";

        rec.onstart = () => {
          setIsListening(true);
        };

        rec.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInputMessage((prev) => (prev ? prev + " " + transcript : transcript));
        };

        rec.onerror = (event: any) => {
          console.error("Speech recognition error:", event);
          setIsListening(false);
        };

        rec.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = rec;
      }
    }
  }, []);

  const toggleListen = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error("Failed to start speech recognition:", err);
      }
    }
  };

  // Connection check helper for Ollama
  const checkOllamaConnection = async (url: string) => {
    setIsOllamaConnecting(true);
    setOllamaStatus("checking");
    try {
      const res = await fetch(`/api/ollama?url=${encodeURIComponent(url)}`, {
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        const data = await res.json();
        const models = data.models?.map((m: any) => m.name) || [];
        setOllamaModels(models);
        setOllamaStatus("connected");
        if (models.length > 0) {
          // Keep current model if it exists in the fetched list, otherwise default to first available
          const savedModel = localStorage.getItem("pitch_arena_ollama_model");
          if (savedModel && models.includes(savedModel)) {
            setSelectedOllamaModel(savedModel);
          } else {
            setSelectedOllamaModel(models[0]);
            localStorage.setItem("pitch_arena_ollama_model", models[0]);
          }
        }
      } else {
        setOllamaStatus("disconnected");
      }
    } catch (error) {
      setOllamaStatus("disconnected");
    } finally {
      setIsOllamaConnecting(false);
    }
  };

  // Load API Key and configuration from local storage on mount
  useEffect(() => {
    setMounted(true);
    const savedKey = localStorage.getItem("pitch_arena_gemini_key");
    if (savedKey) {
      setApiKey(savedKey);
    } else {
      const userKey = "";
      setApiKey(userKey);
      localStorage.setItem("pitch_arena_gemini_key", userKey);
    }

    const savedEngine = localStorage.getItem("pitch_arena_engine") as "gemini" | "ollama" | "huggingface" | null;
    if (savedEngine) {
      setAiEngine(savedEngine);
    }

    const savedHfToken = localStorage.getItem("pitch_arena_hf_token");
    if (savedHfToken) {
      setHfToken(savedHfToken);
    }

    const savedHfModel = localStorage.getItem("pitch_arena_hf_model");
    if (savedHfModel) {
      setSelectedHFModel(savedHfModel);
    }

    const savedOllamaUrl = localStorage.getItem("pitch_arena_ollama_url");
    if (savedOllamaUrl) {
      setOllamaUrl(savedOllamaUrl);
    }

    const savedOllamaModel = localStorage.getItem("pitch_arena_ollama_model");
    if (savedOllamaModel) {
      setSelectedOllamaModel(savedOllamaModel);
    }

    // Load saved pitch history from localStorage
    setSavedSessions(getSavedSessions());
  }, []);

  // Trigger Ollama connection check when engine is switched to Ollama
  useEffect(() => {
    if (mounted && aiEngine === "ollama") {
      checkOllamaConnection(ollamaUrl);
    }
  }, [mounted, aiEngine, ollamaUrl]);

  // Settings modification handlers
  const handleEngineChange = (engine: "gemini" | "ollama" | "huggingface") => {
    setAiEngine(engine);
    localStorage.setItem("pitch_arena_engine", engine);
  };

  const handleSaveOllamaUrl = (url: string) => {
    setOllamaUrl(url);
    localStorage.setItem("pitch_arena_ollama_url", url);
  };

  const handleSaveOllamaModel = (model: string) => {
    setSelectedOllamaModel(model);
    localStorage.setItem("pitch_arena_ollama_model", model);
  };

  // Session History management
  const handleLoadSession = (session: SavedPitchSession) => {
    setStartupProfile(session.startupProfile);
    setConversation(session.conversation);
    setMetricsLedger(session.metricsLedger);
    setInvestorStates(session.investorStates);
    setScorecard(session.scorecard);
    setAiEngine(session.engine);
    if (session.engine === "ollama" && session.modelName) {
      setSelectedOllamaModel(session.modelName);
    } else if (session.engine === "huggingface" && session.modelName) {
      setSelectedHFModel(session.modelName);
    }
    
    if (session.scorecard) {
      setStep("scorecard");
    } else {
      setStep("chat");
      setCurrentStage("pitch");
    }
    
    setLoadedSessionId(session.id);
    setIsHistoryOpen(false);
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = deleteSavedSession(id);
    setSavedSessions(updated);
    if (loadedSessionId === id) {
      handleReset();
    }
  };

  const handleClearAllHistory = () => {
    if (confirm("Are you sure you want to clear all saved boardroom history? This cannot be undone.")) {
      clearSavedSessions();
      setSavedSessions([]);
      handleReset();
    }
  };

  // Save API Key helper
  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem("pitch_arena_gemini_key", key);
  };

  // Scroll to bottom of chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversation, isModelResponding]);

  if (!mounted) return null;

  // File drop handler for PDF
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      alert("Please upload a PDF file.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(",")[1];
      setPdfFile({
        data: base64Data,
        mimeType: file.type,
        name: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  const removePdfFile = () => {
    setPdfFile(null);
  };

  // Initializing the Simulation
  const handleStartSimulation = async () => {
    if (aiEngine === "gemini" && !apiKey) {
      alert("Please enter a valid Gemini API Key to run the simulation.");
      return;
    }
    if (aiEngine === "huggingface" && !hfToken) {
      alert("Please enter a valid Hugging Face API Token to run the simulation.");
      return;
    }
    if (aiEngine === "ollama" && ollamaStatus === "disconnected") {
      alert("Ollama is currently offline. Please ensure Ollama is running locally and try again.");
      return;
    }

    setStep("chat");
    setIsModelResponding(false);

    const initialModeratorMsg: Message = {
      id: "mod-1",
      sender: "moderator",
      text: `Welcome to the Boardroom. Today, the investment committee of Apex Ventures & partners is evaluating ${startupProfile.name}. We have GP Sarah Chen, Growth Partner Elena Rostova, and Operator Dave Kessler on the panel. The floor is yours, Founder. Please present your opening pitch to start the meeting.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setConversation([initialModeratorMsg]);
    setCurrentSpeaker(null);
    setCurrentStage("pitch");
  };

  // User sends a response
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || isModelResponding) return;

    const userText = inputMessage.trim();
    setInputMessage("");

    const founderMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: "founder",
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const updatedConversation = [...conversation, founderMsg];
    setConversation(updatedConversation);
    setIsModelResponding(true);
    setContradictionAlert(null);

    try {
      let response;
      if (aiEngine === "gemini") {
        response = await runSimulationStep(
          apiKey,
          startupProfile,
          updatedConversation,
          currentStage,
          metricsLedger,
          investorStates,
          pdfFile || undefined
        );
      } else if (aiEngine === "huggingface") {
        response = await runHFSimulationStep(
          hfToken,
          selectedHFModel,
          startupProfile,
          updatedConversation,
          currentStage,
          metricsLedger,
          investorStates
        );
      } else {
        response = await runOllamaSimulationStep(
          ollamaUrl,
          selectedOllamaModel,
          startupProfile,
          updatedConversation,
          currentStage,
          metricsLedger,
          investorStates
        );
      }

      if (response.contradictionFlag) {
        setContradictionAlert(response.contradictionFlag);
        // Clear alert after 8 seconds
        setTimeout(() => setContradictionAlert(null), 8000);
      }

      // If the stage switched, add a moderator system note
      const newMessages: Message[] = [];
      if (response.stage !== currentStage && response.stage !== "decision") {
        const stageLabel = getStageLabel(response.stage);
        newMessages.push({
          id: `mod-switch-${Date.now()}`,
          sender: "moderator",
          text: `[Moderator Note] The committee is moving the discussion from the "${getStageLabel(currentStage)}" stage into the "${stageLabel}" stage.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });
      }

      const investorMsg: Message = {
        id: `msg-resp-${Date.now()}`,
        sender: response.speaker as any,
        text: response.text,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      newMessages.push(investorMsg);
      setConversation((prev) => [...prev, ...newMessages]);
      setCurrentSpeaker(response.speaker as any);
      setCurrentStage(response.stage);
      setInvestorStates(response.investorUpdates);
      setMetricsLedger(response.metricsLedger);

      // If stage became decision, automatically trigger committee scorecard
      if (response.stage === "decision") {
        await handleWrapUpSimulation(updatedConversation, response.metricsLedger, response.investorUpdates);
      }

    } catch (error: any) {
      console.error(error);
      const isQuotaError = error.message?.toLowerCase().includes("quota") || 
                           error.message?.toLowerCase().includes("429") || 
                           error.message?.toLowerCase().includes("limit");
      if (aiEngine === "gemini" && isQuotaError) {
        alert("Gemini API Free-Tier Quota Exceeded.\n\nPlease toggle 'Ollama Offline' mode in the top-right header to run the simulation locally using your own models offline, or enter a valid Gemini API Key.");
      } else {
        alert(`Failed to get response from the investor panel. Error: ${error.message || error}`);
      }
    } finally {
      setIsModelResponding(false);
    }
  };

  // Skip directly to committee vote / decision
  const handleWrapUpSimulation = async (
    customConversation?: Message[],
    customMetrics?: Record<string, string>,
    customInvestorStates?: typeof investorStates
  ) => {
    setIsGeneratingScorecard(true);
    setStep("scorecard");

    try {
      const activeConv = customConversation || conversation;
      const activeMetrics = customMetrics || metricsLedger;
      const activeInvestor = customInvestorStates || investorStates;

      let response: Scorecard;
      if (aiEngine === "gemini") {
        response = await generateFinalScorecard(
          apiKey,
          startupProfile,
          activeConv,
          activeMetrics,
          activeInvestor,
          pdfFile || undefined
        );
      } else if (aiEngine === "huggingface") {
        response = await generateHFFinalScorecard(
          hfToken,
          selectedHFModel,
          startupProfile,
          activeConv,
          activeMetrics,
          activeInvestor
        );
      } else {
        response = await generateOllamaFinalScorecard(
          ollamaUrl,
          selectedOllamaModel,
          startupProfile,
          activeConv,
          activeMetrics,
          activeInvestor
        );
      }

      setScorecard(response);

      // Auto-save the completed session to history
      const saved = savePitchSession({
        startupProfile,
        conversation: activeConv,
        metricsLedger: activeMetrics,
        investorStates: activeInvestor,
        scorecard: response,
        engine: aiEngine,
        modelName: aiEngine === "ollama" ? selectedOllamaModel : aiEngine === "huggingface" ? selectedHFModel : undefined,
      });

      setSavedSessions(getSavedSessions());
      setLoadedSessionId(saved.id);
    } catch (error: any) {
      console.error(error);
      const isQuotaError = error.message?.toLowerCase().includes("quota") || 
                           error.message?.toLowerCase().includes("429") || 
                           error.message?.toLowerCase().includes("limit");
      if (aiEngine === "gemini" && isQuotaError) {
        alert("Gemini API Free-Tier Quota Exceeded during scorecard generation.\n\nYou can switch to 'Ollama Offline' mode in the top-right header to evaluate locally using your own models offline, or enter a valid Gemini API Key.");
      } else {
        alert(`Scorecard generation failed. Error: ${error.message || error}`);
      }
      setStep("chat");
    } finally {
      setIsGeneratingScorecard(false);
    }
  };

  const getStageLabel = (s: string) => {
    switch (s) {
      case "pitch": return "1. Value Proposition";
      case "traction": return "2. Market Traction";
      case "economics": return "3. Unit Economics";
      case "moat": return "4. Competitive Moat";
      case "diligence": return "5. Due Diligence";
      case "decision": return "6. Investment Committee";
      default: return s;
    }
  };

  // Reset simulation
  const handleReset = () => {
    setConversation([]);
    setMetricsLedger({});
    setInvestorStates({
      sarah: { sentiment: "neutral", confidence: 50, risks: [] },
      elena: { sentiment: "neutral", confidence: 50, risks: [] },
      dave: { sentiment: "friendly", confidence: 60, risks: [] },
    });
    setCurrentStage("pitch");
    setCurrentSpeaker(null);
    setScorecard(null);
    setStep("setup");
    setLoadedSessionId(null);
  };

  // Radar chart data mapper
  const radarData = scorecard
    ? [
        { subject: "Market Size (TAM)", A: scorecard.ratings.tam, fullMark: 10 },
        { subject: "Founder / Team", A: scorecard.ratings.team, fullMark: 10 },
        { subject: "Unit Economics", A: scorecard.ratings.economics, fullMark: 10 },
        { subject: "Moat strength", A: scorecard.ratings.moat, fullMark: 10 },
        { subject: "Traction", A: scorecard.ratings.traction, fullMark: 10 },
      ]
    : [];

  return (
    <div className="flex-1 flex flex-col bg-[#03030b] text-slate-100 min-h-screen">
      {/* HEADER BAR */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center active-glow">
            <Zap className="h-5 w-5 text-slate-950 font-bold" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-200 via-indigo-50 to-cyan-200 bg-clip-text text-transparent">
              PitchArena
            </h1>
            <p className="text-xs text-slate-400 font-medium">AI-Driven Venture Capital Simulation</p>
          </div>
        </div>

        {/* AI Engine & API Key Header bar */}
        <div className="flex items-center gap-4">
          {/* Pitch History Button */}
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="relative flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-350 hover:text-slate-100 transition-all cursor-pointer"
          >
            <History className="h-3.5 w-3.5 text-indigo-400" />
            <span>History</span>
            {savedSessions.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-4.5 w-4.5 bg-indigo-500 rounded-full flex items-center justify-center text-[9px] font-black text-slate-950">
                {savedSessions.length}
              </span>
            )}
          </button>

          {/* Engine Selector */}
          <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800/80">
            <button
              onClick={() => handleEngineChange("gemini")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                aiEngine === "gemini"
                  ? "bg-indigo-650 text-slate-100 font-bold shadow-md shadow-indigo-550/10"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Gemini API
            </button>
            <button
              onClick={() => handleEngineChange("huggingface")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                aiEngine === "huggingface"
                  ? "bg-indigo-650 text-slate-100 font-bold shadow-md shadow-indigo-550/10"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Hugging Face
            </button>
            <button
              onClick={() => handleEngineChange("ollama")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                aiEngine === "ollama"
                  ? "bg-indigo-650 text-slate-100 font-bold shadow-md shadow-indigo-550/10"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Ollama Offline
            </button>
          </div>

          {/* Conditionally Render Key Input or status indicator */}
          {aiEngine === "gemini" && (
            <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800/80">
              <Lock className="h-3.5 w-3.5 text-indigo-400" />
              <input
                type="password"
                placeholder="Enter Gemini API Key..."
                value={apiKey}
                onChange={(e) => handleSaveApiKey(e.target.value)}
                className="bg-transparent text-xs text-slate-350 placeholder-slate-500 focus:outline-none w-44"
              />
              {apiKey ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              )}
            </div>
          )}
          {aiEngine === "huggingface" && (
            <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800/80">
              <Lock className="h-3.5 w-3.5 text-indigo-400" />
              <input
                type="password"
                placeholder="Enter HF API Token..."
                value={hfToken}
                onChange={(e) => {
                  setHfToken(e.target.value);
                  localStorage.setItem("pitch_arena_hf_token", e.target.value);
                }}
                className="bg-transparent text-xs text-slate-350 placeholder-slate-500 focus:outline-none w-40"
              />
              <select
                value={selectedHFModel}
                onChange={(e) => {
                  setSelectedHFModel(e.target.value);
                  localStorage.setItem("pitch_arena_hf_model", e.target.value);
                }}
                className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-[10px] text-slate-350 focus:outline-none max-w-[130px] font-semibold"
              >
                <option value="meta-llama/Llama-3.2-3B-Instruct">Llama 3.2 3B</option>
                <option value="Qwen/Qwen2.5-72B-Instruct">Qwen 2.5 72B</option>
                <option value="meta-llama/Meta-Llama-3-8B-Instruct">Llama 3 8B</option>
              </select>
            </div>
          )}
          {aiEngine === "ollama" && (
            <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800/80 select-none">
              <Database className="h-3.5 w-3.5 text-indigo-450" />
              <span className="text-xs text-slate-350 font-bold truncate max-w-[100px]">
                {selectedOllamaModel || "No Model"}
              </span>
              {ollamaStatus === "connected" ? (
                <span className="flex h-2 w-2 rounded-full bg-emerald-500" title="Connected to Ollama" />
              ) : ollamaStatus === "checking" ? (
                <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" title="Connecting..." />
              ) : (
                <span className="flex h-2 w-2 rounded-full bg-rose-500" title="Ollama Server Offline" />
              )}
            </div>
          )}
        </div>
      </header>

      {/* -------------------- STEP 1: SETUP SCREEN -------------------- */}
      {step === "setup" && (
        <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Setup Inputs Form */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 h-40 w-40 bg-indigo-500/10 rounded-full blur-3xl -z-10" />
              <div className="flex items-center gap-2 mb-6">
                <Sparkles className="h-5 w-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-slate-200">Startup Profile Setup</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Startup Name
                  </label>
                  <input
                    type="text"
                    value={startupProfile.name}
                    onChange={(e) => setStartupProfile({ ...startupProfile, name: e.target.value })}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:outline-none transition-all"
                    placeholder="e.g. EcoSphera"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Industry / Sector
                  </label>
                  <input
                    type="text"
                    value={startupProfile.industry}
                    onChange={(e) => setStartupProfile({ ...startupProfile, industry: e.target.value })}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:outline-none transition-all"
                    placeholder="e.g. Climate Tech SaaS"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Funding Stage
                  </label>
                  <select
                    value={startupProfile.stage}
                    onChange={(e) => setStartupProfile({ ...startupProfile, stage: e.target.value })}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none transition-all"
                  >
                    <option value="Pre-Seed">Pre-Seed</option>
                    <option value="Seed">Seed</option>
                    <option value="Series A">Series A</option>
                    <option value="Series B">Series B</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Target Funding Amount
                  </label>
                  <input
                    type="text"
                    value={startupProfile.fundingGoal}
                    onChange={(e) => setStartupProfile({ ...startupProfile, fundingGoal: e.target.value })}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:outline-none transition-all"
                    placeholder="e.g. $1,500,000"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Elevator Pitch (One-Liner)
                </label>
                <input
                  type="text"
                  value={startupProfile.oneLiner}
                  onChange={(e) => setStartupProfile({ ...startupProfile, oneLiner: e.target.value })}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:outline-none transition-all"
                  placeholder="e.g. AI carbon footprint optimization platform for manufacturing"
                />
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Pitch Deck Outline / Text
                  </label>
                  <span className="text-[10px] text-slate-500">Provide key metrics and slide summaries</span>
                </div>
                <textarea
                  rows={8}
                  value={startupProfile.pitchDeckText}
                  onChange={(e) => setStartupProfile({ ...startupProfile, pitchDeckText: e.target.value })}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-xs font-mono text-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:outline-none transition-all"
                  placeholder="Describe your market TAM, customer traction, unit economics, team members..."
                />
              </div>

              {/* PDF Drag and Drop */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Attach PDF Pitch Deck (Optional)
                </label>
                <div className="border border-dashed border-slate-800 rounded-xl p-4 bg-slate-950/30 hover:bg-slate-950/50 hover:border-slate-700/80 transition-all flex flex-col items-center justify-center text-center cursor-pointer relative">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  {pdfFile ? (
                    <div className="flex items-center gap-3 w-full justify-between bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400">
                          <FileText className="h-4.5 w-4.5" />
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-semibold text-slate-200 max-w-[250px] truncate">
                            {pdfFile.name}
                          </p>
                          <p className="text-[10px] text-slate-500">PDF Document attached</p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removePdfFile();
                        }}
                        className="h-6 w-6 rounded-md hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-100"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <FileText className="h-8 w-8 text-slate-600 mb-2" />
                      <p className="text-xs text-slate-300 font-medium">Drag & drop your pitch deck PDF here</p>
                      <p className="text-[10px] text-slate-500 mt-1">Accepts PDF format (will be sent inline to Gemini)</p>
                    </>
                  )}
                </div>
              </div>

              {/* Ollama Configuration Section (shows when Ollama is selected) */}
              {aiEngine === "ollama" && (
                <div className="mt-6 pt-6 border-t border-slate-800/80">
                  <div className="flex items-center gap-2 mb-4">
                    <Settings className="h-4 w-4 text-indigo-400" />
                    <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Ollama Configuration</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        Ollama Server URL
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={ollamaUrl}
                          onChange={(e) => handleSaveOllamaUrl(e.target.value)}
                          className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none transition-all"
                          placeholder="http://localhost:11434"
                        />
                        <button
                          type="button"
                          onClick={() => checkOllamaConnection(ollamaUrl)}
                          disabled={isOllamaConnecting}
                          className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 px-3 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {isOllamaConnecting ? "Checking..." : "Verify"}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        Select Local Model
                      </label>
                      {ollamaStatus === "connected" && ollamaModels.length > 0 ? (
                        <select
                          value={selectedOllamaModel}
                          onChange={(e) => handleSaveOllamaModel(e.target.value)}
                          className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none transition-all cursor-pointer"
                        >
                          {ollamaModels.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={selectedOllamaModel}
                            onChange={(e) => handleSaveOllamaModel(e.target.value)}
                            placeholder="e.g. llama3"
                            className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none transition-all"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3.5 flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Status:</span>
                    {ollamaStatus === "connected" ? (
                      <span className="text-[10px] font-bold text-emerald-450 flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-550/20">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Connected ({ollamaModels.length} models)
                      </span>
                    ) : ollamaStatus === "checking" ? (
                      <span className="text-[10px] font-bold text-amber-450 flex items-center gap-1.5 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-550/20">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-450 animate-pulse" /> Checking...
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-rose-450 flex items-center gap-1.5 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-550/20" title="Check if Ollama server is running and handles CORS requests.">
                        ⚠️ Not Detected (Ensure Ollama is running)
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Hugging Face Configuration Section */}
              {aiEngine === "huggingface" && (
                <div className="mt-6 pt-6 border-t border-slate-800/80">
                  <div className="flex items-center gap-2 mb-4">
                    <Settings className="h-4 w-4 text-indigo-400" />
                    <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Hugging Face Configuration</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        Hugging Face Token
                      </label>
                      <input
                        type="password"
                        placeholder="Enter HF API Token (Bearer Token)..."
                        value={hfToken}
                        onChange={(e) => {
                          setHfToken(e.target.value);
                          localStorage.setItem("pitch_arena_hf_token", e.target.value);
                        }}
                        className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        Select Hugging Face Model
                      </label>
                      <select
                        value={selectedHFModel}
                        onChange={(e) => {
                          setSelectedHFModel(e.target.value);
                          localStorage.setItem("pitch_arena_hf_model", e.target.value);
                        }}
                        className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none transition-all cursor-pointer font-semibold"
                      >
                        <option value="meta-llama/Llama-3.2-3B-Instruct">Llama 3.2 3B Instruct</option>
                        <option value="Qwen/Qwen2.5-72B-Instruct">Qwen 2.5 72B Instruct</option>
                        <option value="meta-llama/Meta-Llama-3-8B-Instruct">Llama 3 8B Instruct</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Investors & Start Button */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* The Investor Panel Intro */}
            <div className="glass-panel rounded-2xl p-6 flex-1 flex flex-col">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-indigo-400 mb-4 flex items-center gap-2">
                <Users className="h-4 w-4" /> The AI Investment Panel
              </h3>

              {/* Investor Avatars List */}
              <div className="flex flex-col gap-4 flex-1">
                {/* Sarah Chen */}
                <div className="flex items-start gap-4 p-3 bg-slate-900/30 rounded-xl border border-slate-850">
                  <img
                    src="/sarah.png"
                    alt="Sarah Chen"
                    className="h-12 w-12 rounded-xl object-cover border border-indigo-500/30 shadow-inner"
                  />
                  <div>
                    <h4 className="text-sm font-bold text-slate-200">Sarah Chen</h4>
                    <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wide">GP, Apex Ventures</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Focuses on TAM, exits, market scalability, and business defensibility. Analyst-minded, ex-McKinsey.
                    </p>
                  </div>
                </div>

                {/* Elena Rostova */}
                <div className="flex items-start gap-4 p-3 bg-slate-900/30 rounded-xl border border-slate-850">
                  <img
                    src="/elena.png"
                    alt="Elena Rostova"
                    className="h-12 w-12 rounded-xl object-cover border border-purple-500/30"
                  />
                  <div>
                    <h4 className="text-sm font-bold text-slate-200">Elena Rostova</h4>
                    <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-wide">Growth Partner, Scale Capital</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Focuses strictly on unit economics: CAC, LTV, pricing models, gross margins, and retention charts.
                    </p>
                  </div>
                </div>

                {/* Dave Kessler */}
                <div className="flex items-start gap-4 p-3 bg-slate-900/30 rounded-xl border border-slate-850">
                  <img
                    src="/dave.png"
                    alt="Dave Kessler"
                    className="h-12 w-12 rounded-xl object-cover border border-cyan-500/30"
                  />
                  <div>
                    <h4 className="text-sm font-bold text-slate-200">Dave Kessler</h4>
                    <p className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wide">Angel & Operator</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Focuses on founder conviction, execution velocity, team synergy, and product-market fit. Friendly and empathetic.
                    </p>
                  </div>
                </div>
              </div>

              {/* Start Button */}
              <button
                onClick={handleStartSimulation}
                className="w-full mt-6 py-4 bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-slate-950 font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer text-slate-950"
              >
                <span>Enter Boardroom & Start Pitch</span>
                <ArrowRight className="h-5 w-5" />
              </button>

              {aiEngine === "gemini" && !apiKey && (
                <p className="text-[11px] text-amber-400/80 text-center mt-3 flex items-center gap-1.5 justify-center">
                  <AlertTriangle className="h-3 w-3" /> Please enter your Gemini API Key in the top lock bar.
                </p>
              )}
              {aiEngine === "huggingface" && !hfToken && (
                <p className="text-[11px] text-amber-400/80 text-center mt-3 flex items-center gap-1.5 justify-center">
                  <AlertTriangle className="h-3 w-3" /> Please enter your Hugging Face API Token in the top lock bar.
                </p>
              )}
              {aiEngine === "ollama" && ollamaStatus === "disconnected" && (
                <p className="text-[11px] text-rose-400/80 text-center mt-3 flex items-center gap-1.5 justify-center">
                  <AlertTriangle className="h-3 w-3" /> Ollama is disconnected. Please make sure the server is running locally.
                </p>
              )}
            </div>
          </div>
        </main>
      )}

      {/* -------------------- STEP 2: DEAL ROOM / PITCH SCREEN -------------------- */}
      {step === "chat" && (
        <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
          {/* LEFT SIDEBAR: Investor Panel & Metrics Tracker */}
          <aside className="lg:col-span-4 flex flex-col gap-6 overflow-y-auto max-h-[80vh] pr-2">
            {/* Stage Stepper Tracker */}
            <div className="glass-panel rounded-2xl p-5">
              <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-4">Pitch Progress</h3>
              <div className="flex flex-col gap-2">
                {["pitch", "traction", "economics", "moat", "diligence", "decision"].map((st) => {
                  const isActive = currentStage === st;
                  const stages = ["pitch", "traction", "economics", "moat", "diligence", "decision"];
                  const isCompleted = stages.indexOf(st) < stages.indexOf(currentStage);

                  return (
                    <div key={st} className="flex items-center gap-3.5">
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center border font-bold text-xs transition-all ${
                        isActive
                          ? "bg-indigo-500 border-indigo-400 text-slate-950 font-black shadow-indigo-500/20 active-glow"
                          : isCompleted
                          ? "bg-slate-900 border-emerald-500/50 text-emerald-400"
                          : "bg-slate-950/60 border-slate-800 text-slate-500"
                      }`}>
                        {isCompleted ? "✓" : stages.indexOf(st) + 1}
                      </div>
                      <span className={`text-xs font-semibold ${
                        isActive
                          ? "text-slate-100 glow-text-cyan font-bold"
                          : isCompleted
                          ? "text-slate-400 line-through/20"
                          : "text-slate-500"
                      }`}>
                        {getStageLabel(st).split(". ")[1]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Investor Panel Live Sentiment Cards */}
            <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4">
              <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Investor Panel Live Sentiment</h3>

              {/* Sarah Live Panel */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                currentSpeaker === "sarah"
                  ? "bg-slate-900/90 border-indigo-500 active-glow"
                  : "bg-slate-950/40 border-slate-900"
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <img src="/sarah.png" className="h-9 w-9 rounded-lg object-cover" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">Sarah Chen</h4>
                      <span className="text-[9px] text-slate-500 font-semibold">APEX PARTNER</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      investorStates.sarah.sentiment === "friendly"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : investorStates.sarah.sentiment === "skeptical"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : investorStates.sarah.sentiment === "hostile"
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        : "bg-slate-800 text-slate-400"
                    }`}>
                      {investorStates.sarah.sentiment}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 mb-2">
                  <span className="text-[10px] text-slate-400 font-medium">Confidence:</span>
                  <div className="flex-1 h-1.5 bg-slate-950 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full transition-all duration-500"
                      style={{ width: `${investorStates.sarah.confidence}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-indigo-300">{investorStates.sarah.confidence}%</span>
                </div>

                {investorStates.sarah.risks.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {investorStates.sarah.risks.slice(0, 3).map((r, i) => (
                      <span key={i} className="text-[9px] bg-rose-500/10 text-rose-400 px-1.5 py-0.5 rounded border border-rose-500/20 max-w-[150px] truncate">
                        ⚠️ {r}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-[9px] text-slate-500 italic">No risks flagged yet.</span>
                )}
              </div>

              {/* Elena Live Panel */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                currentSpeaker === "elena"
                  ? "bg-slate-900/90 border-purple-500 active-glow"
                  : "bg-slate-950/40 border-slate-900"
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <img src="/elena.png" className="h-9 w-9 rounded-lg object-cover" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">Elena Rostova</h4>
                      <span className="text-[9px] text-slate-500 font-semibold">GROWTH PARTNER</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      investorStates.elena.sentiment === "friendly"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : investorStates.elena.sentiment === "skeptical"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : investorStates.elena.sentiment === "hostile"
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        : "bg-slate-800 text-slate-400"
                    }`}>
                      {investorStates.elena.sentiment}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 mb-2">
                  <span className="text-[10px] text-slate-400 font-medium">Confidence:</span>
                  <div className="flex-1 h-1.5 bg-slate-950 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full transition-all duration-500"
                      style={{ width: `${investorStates.elena.confidence}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-purple-300">{investorStates.elena.confidence}%</span>
                </div>

                {investorStates.elena.risks.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {investorStates.elena.risks.slice(0, 3).map((r, i) => (
                      <span key={i} className="text-[9px] bg-rose-500/10 text-rose-400 px-1.5 py-0.5 rounded border border-rose-500/20 max-w-[150px] truncate">
                        ⚠️ {r}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-[9px] text-slate-500 italic">No risks flagged yet.</span>
                )}
              </div>

              {/* Dave Live Panel */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                currentSpeaker === "dave"
                  ? "bg-slate-900/90 border-cyan-500 active-glow"
                  : "bg-slate-950/40 border-slate-900"
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <img src="/dave.png" className="h-9 w-9 rounded-lg object-cover" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">Dave Kessler</h4>
                      <span className="text-[9px] text-slate-500 font-semibold">ANGEL & OPERATOR</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      investorStates.dave.sentiment === "friendly"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : investorStates.dave.sentiment === "skeptical"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : investorStates.dave.sentiment === "hostile"
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        : "bg-slate-800 text-slate-400"
                    }`}>
                      {investorStates.dave.sentiment}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 mb-2">
                  <span className="text-[10px] text-slate-400 font-medium">Confidence:</span>
                  <div className="flex-1 h-1.5 bg-slate-950 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full transition-all duration-500"
                      style={{ width: `${investorStates.dave.confidence}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-cyan-300">{investorStates.dave.confidence}%</span>
                </div>

                {investorStates.dave.risks.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {investorStates.dave.risks.slice(0, 3).map((r, i) => (
                      <span key={i} className="text-[9px] bg-rose-500/10 text-rose-400 px-1.5 py-0.5 rounded border border-rose-500/20 max-w-[150px] truncate">
                        ⚠️ {r}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-[9px] text-slate-500 italic">No risks flagged yet.</span>
                )}
              </div>
            </div>

            {/* Live Metrics Memory Ledger */}
            <div className="glass-panel rounded-2xl p-5 flex flex-col">
              <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-3">AI Memory Ledger (Metrics)</h3>
              <div className="bg-slate-950/65 rounded-xl border border-slate-900 p-1 flex-1">
                {Object.keys(metricsLedger).length > 0 ? (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-900 text-[10px] text-slate-500 uppercase font-semibold">
                        <th className="px-3.5 py-2">Metric</th>
                        <th className="px-3.5 py-2 text-right">Value Stated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(metricsLedger).map(([k, v]) => (
                        <tr key={k} className="border-b border-slate-950 text-xs text-slate-300">
                          <td className="px-3.5 py-2 font-mono text-slate-400 capitalize">{k.replace(/([A-Z])/g, " $1")}</td>
                          <td className="px-3.5 py-2 text-right font-bold text-indigo-300 font-mono">{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-6">
                    <Info className="h-6 w-6 text-slate-600 mx-auto mb-1.5" />
                    <p className="text-[10px] text-slate-500 italic">No hard metrics stated yet.</p>
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* MAIN CHAT AREA */}
          <section className="lg:col-span-8 flex flex-col glass-panel rounded-2xl overflow-hidden relative max-h-[82vh]">
            
            {/* Contradiction Alert banner */}
            {contradictionAlert && (
              <div className="absolute top-0 inset-x-0 bg-rose-500/20 border-b border-rose-500/40 backdrop-blur-md p-3.5 text-xs text-rose-200 z-30 flex items-start gap-3 active-glow">
                <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-rose-300 uppercase tracking-wider text-[10px] mb-0.5">Metrics Mismatch Detected</h4>
                  <p className="leading-tight">{contradictionAlert}</p>
                </div>
              </div>
            )}

            {/* Chat Messages Log */}
            <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
              {conversation.map((msg, index) => {
                const isMod = msg.sender === "moderator";
                const isUser = msg.sender === "founder";
                const speakerName = msg.sender === "sarah" ? "Sarah Chen" : msg.sender === "elena" ? "Elena Rostova" : msg.sender === "dave" ? "Dave Kessler" : "Committee Chair";
                const speakerAvatar = msg.sender === "sarah" ? "/sarah.png" : msg.sender === "elena" ? "/elena.png" : "/dave.png";

                if (isMod) {
                  return (
                    <div key={msg.id || index} className="flex justify-center w-full my-1">
                      <div className="bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5 max-w-2xl text-center text-xs text-indigo-300/90 shadow-sm leading-relaxed">
                        {msg.text}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.id || index} className={`flex w-full gap-4 ${isUser ? "justify-end" : "justify-start"}`}>
                    {!isUser && (
                      <img src={speakerAvatar} className="h-9 w-9 rounded-lg object-cover border border-slate-800 shrink-0" />
                    )}
                    <div className="flex flex-col gap-1 max-w-[70%]">
                      <span className={`text-[10px] font-bold tracking-wide uppercase ${isUser ? "text-indigo-400 text-right" : "text-slate-400"}`}>
                        {isUser ? "You (Founder)" : speakerName} • <span className="font-normal text-slate-500 uppercase">{msg.timestamp}</span>
                      </span>
                      <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                        isUser
                          ? "bg-indigo-600 text-slate-950 font-semibold rounded-tr-none"
                          : "bg-slate-900 border border-slate-850 rounded-tl-none text-slate-200"
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  </div>
                );
              })}

              {isModelResponding && (
                <div className="flex w-full gap-4 justify-start">
                  <div className="h-9 w-9 rounded-lg bg-slate-900 border border-slate-800 shrink-0 flex items-center justify-center text-slate-500">
                    <RefreshCw className="h-4.5 w-4.5 animate-spin" />
                  </div>
                  <div className="flex flex-col gap-1 max-w-[70%]">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Panel writing...</span>
                    <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-2xl rounded-tl-none flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-indigo-500 animate-bounce delay-100" />
                      <span className="h-2 w-2 rounded-full bg-indigo-500 animate-bounce delay-200" />
                      <span className="h-2 w-2 rounded-full bg-indigo-500 animate-bounce delay-300" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Control Input Form */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-850 bg-slate-950/80 backdrop-blur-md flex gap-3">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={isModelResponding}
                placeholder="Pitch your metrics, answer questions, or handle challenges..."
                className="flex-1 bg-slate-900/90 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 text-slate-200 rounded-xl px-4 text-sm focus:outline-none transition-all disabled:opacity-50"
              />
              
              {/* Microphone Toggle Button */}
              <button
                type="button"
                onClick={toggleListen}
                className={`px-4 py-2.5 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                  isListening
                    ? "bg-rose-500 hover:bg-rose-400 text-slate-950 border-rose-600 active-glow font-bold animate-pulse"
                    : "bg-slate-900 hover:bg-slate-800 border-slate-800 text-indigo-400 hover:text-indigo-350"
                }`}
                title={isListening ? "Listening... Click to stop" : "Voice Input (Speech-to-Text)"}
              >
                {isListening ? (
                  <MicOff className="h-4.5 w-4.5 animate-bounce" />
                ) : (
                  <Mic className="h-4.5 w-4.5" />
                )}
              </button>

              <button
                type="submit"
                disabled={isModelResponding || !inputMessage.trim()}
                className="bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl flex items-center justify-center disabled:opacity-40 transition-all text-slate-950 cursor-pointer"
              >
                <Send className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => handleWrapUpSimulation()}
                className="bg-slate-900 hover:bg-slate-800 text-indigo-400 hover:text-indigo-300 border border-slate-850 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Wrap Up & Vote
              </button>
            </form>
          </section>
        </main>
      )}

      {/* -------------------- STEP 3: SCORECARD SCREEN -------------------- */}
      {step === "scorecard" && (
        <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-10">
          {isGeneratingScorecard ? (
            <div className="h-[70vh] flex flex-col items-center justify-center text-center">
              <RefreshCw className="h-12 w-12 text-indigo-500 animate-spin mb-4" />
              <h2 className="text-xl font-bold text-slate-200">Investment Committee Convening</h2>
              <p className="text-slate-400 text-sm mt-1 max-w-sm">
                Sarah, Elena, and Dave are drafting their formal evaluation memo, calculating margins, and casting final votes...
              </p>
            </div>
          ) : scorecard ? (
            <div className="flex flex-col gap-8">
              {/* Top Decision Header Card */}
              <div className={`glass-panel rounded-3xl p-8 border relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 ${
                scorecard.decision === "Invest"
                  ? "border-emerald-500/30"
                  : scorecard.decision === "Pass"
                  ? "border-rose-500/30"
                  : "border-amber-500/30"
              }`}>
                {/* Glow particles background */}
                <div className={`absolute top-0 right-0 h-40 w-40 rounded-full blur-3xl -z-10 ${
                  scorecard.decision === "Invest"
                    ? "bg-emerald-500/10"
                    : scorecard.decision === "Pass"
                    ? "bg-rose-500/10"
                    : "bg-amber-500/10"
                }`} />

                <div>
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-1">
                    Investment Decision
                  </span>
                  <h2 className={`text-4xl font-extrabold tracking-tight uppercase ${
                    scorecard.decision === "Invest"
                      ? "text-emerald-400 glow-text-emerald"
                      : scorecard.decision === "Pass"
                      ? "text-rose-400 text-shadow-red"
                      : "text-amber-400 text-shadow-amber"
                  }`}>
                    {scorecard.decision}
                  </h2>
                  <p className="text-sm text-slate-300 mt-2 max-w-xl leading-relaxed">
                    {scorecard.thesis}
                  </p>
                </div>

                {scorecard.decision !== "Pass" && (
                  <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-900/80 min-w-[240px] text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Proposed Term Sheet</span>
                    <div className="text-2xl font-black text-slate-100 font-mono mt-1">{scorecard.investmentAmount}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">amount at</div>
                    <div className="text-sm font-bold text-indigo-300 font-mono mt-0.5">{scorecard.valuation}</div>
                  </div>
                )}
              </div>

              {/* Radar Chart & Key Metrics Section */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                {/* Radar Chart */}
                <div className="md:col-span-5 glass-panel rounded-2xl p-6 flex flex-col items-center">
                  <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-4 w-full">Evaluation Radar</h3>
                  <div className="h-64 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                        <PolarGrid stroke="#1e293b" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: "bold" }} />
                        <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fill: "#475569" }} />
                        <Radar
                          name="Startup Rating"
                          dataKey="A"
                          stroke={scorecard.decision === "Invest" ? "#34d399" : scorecard.decision === "Pass" ? "#f87171" : "#fbbf24"}
                          fill={scorecard.decision === "Invest" ? "#34d399" : scorecard.decision === "Pass" ? "#f87171" : "#fbbf24"}
                          fillOpacity={0.2}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Score Breakdown Ratings Card */}
                <div className="md:col-span-7 glass-panel rounded-2xl p-6">
                  <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-4">Committee Marks Breakdown</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "Market size / TAM", score: scorecard.ratings.tam, icon: Briefcase, color: "text-indigo-400 bg-indigo-500/10" },
                      { label: "Team / Experience", score: scorecard.ratings.team, icon: Users, color: "text-purple-400 bg-purple-500/10" },
                      { label: "Unit Economics", score: scorecard.ratings.economics, icon: Percent, color: "text-emerald-400 bg-emerald-500/10" },
                      { label: "Defensive Moat", score: scorecard.ratings.moat, icon: ShieldAlert, color: "text-cyan-400 bg-cyan-500/10" },
                      { label: "Customer Traction", score: scorecard.ratings.traction, icon: TrendingUp, color: "text-amber-400 bg-amber-500/10" },
                    ].map((item, idx) => {
                      const Icon = item.icon || Info;
                      return (
                        <div key={idx} className="bg-slate-950/50 p-4 rounded-xl border border-slate-900/60 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${item.color}`}>
                              <Icon className="h-4.5 w-4.5" />
                            </div>
                            <span className="text-xs font-semibold text-slate-300">{item.label}</span>
                          </div>
                          <span className="text-lg font-black text-slate-100 font-mono bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md">
                            {item.score}<span className="text-[10px] font-normal text-slate-500">/10</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Committee Votes & Rationale */}
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-4">Partner Individual Ballots</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Sarah Vote */}
                  <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-900">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <img src="/sarah.png" className="h-7 w-7 rounded-md object-cover border border-indigo-500/30" />
                        <div>
                          <h4 className="text-xs font-bold text-slate-350">Sarah Chen</h4>
                          <span className="text-[8px] text-indigo-400 font-bold uppercase tracking-wider">APEX PARTNER</span>
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase flex items-center gap-1 ${
                        scorecard.investorIndividualVotes.sarah.vote === "Yes"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-rose-500/10 text-rose-400"
                      }`}>
                        {scorecard.investorIndividualVotes.sarah.vote === "Yes" ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
                        {scorecard.investorIndividualVotes.sarah.vote}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 italic leading-relaxed">
                      &ldquo;{scorecard.investorIndividualVotes.sarah.rationale}&rdquo;
                    </p>
                  </div>

                  {/* Elena Vote */}
                  <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-900">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <img src="/elena.png" className="h-7 w-7 rounded-md object-cover border border-purple-500/30" />
                        <div>
                          <h4 className="text-xs font-bold text-slate-350">Elena Rostova</h4>
                          <span className="text-[8px] text-purple-400 font-bold uppercase tracking-wider">GROWTH PARTNER</span>
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase flex items-center gap-1 ${
                        scorecard.investorIndividualVotes.elena.vote === "Yes"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-rose-500/10 text-rose-400"
                      }`}>
                        {scorecard.investorIndividualVotes.elena.vote === "Yes" ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
                        {scorecard.investorIndividualVotes.elena.vote}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 italic leading-relaxed">
                      &ldquo;{scorecard.investorIndividualVotes.elena.rationale}&rdquo;
                    </p>
                  </div>

                  {/* Dave Vote */}
                  <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-900">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <img src="/dave.png" className="h-7 w-7 rounded-md object-cover border border-cyan-500/30" />
                        <div>
                          <h4 className="text-xs font-bold text-slate-350">Dave Kessler</h4>
                          <span className="text-[8px] text-cyan-400 font-bold uppercase tracking-wider">OPERATOR ANGEL</span>
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase flex items-center gap-1 ${
                        scorecard.investorIndividualVotes.dave.vote === "Yes"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-rose-500/10 text-rose-400"
                      }`}>
                        {scorecard.investorIndividualVotes.dave.vote === "Yes" ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
                        {scorecard.investorIndividualVotes.dave.vote}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 italic leading-relaxed">
                      &ldquo;{scorecard.investorIndividualVotes.dave.rationale}&rdquo;
                    </p>
                  </div>
                </div>
              </div>

              {/* Strengths & Weaknesses Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Strengths */}
                <div className="glass-panel rounded-2xl p-6 border-emerald-500/10">
                  <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <ThumbsUp className="h-4 w-4 text-emerald-400" /> Key Strengths Flagged
                  </h3>
                  <ul className="flex flex-col gap-2.5 text-xs text-slate-300">
                    {scorecard.strengths.map((str, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Weaknesses */}
                <div className="glass-panel rounded-2xl p-6 border-rose-500/10">
                  <h3 className="text-xs font-semibold text-rose-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <ThumbsDown className="h-4 w-4 text-rose-400" /> Key Risks & Weaknesses
                  </h3>
                  <ul className="flex flex-col gap-2.5 text-xs text-slate-300">
                    {scorecard.weaknesses.map((weak, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0 mt-1.5" />
                        <span>{weak}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Actionable Feedback Memo */}
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-3">Feedback Memo & Recommendations</h3>
                <p className="text-sm text-slate-300 leading-relaxed font-sans">
                  {scorecard.feedbackForFounder}
                </p>
              </div>

              {scorecard.keyCovenants && scorecard.keyCovenants.length > 0 && (
                <div className="glass-panel rounded-2xl p-6 bg-amber-500/5 border-amber-500/10">
                  <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3">Deal Conditions & Covenants</h3>
                  <ul className="flex flex-col gap-2.5 text-xs text-slate-300">
                    {scorecard.keyCovenants.map((cov, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                        <span>{cov}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Bottom Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={handleReset}
                  className="flex-1 py-4 bg-slate-900 hover:bg-slate-800 text-indigo-400 border border-slate-850 hover:text-indigo-300 font-bold rounded-xl shadow-lg transition-all cursor-pointer text-center"
                >
                  Restart Simulation
                </button>
              </div>
            </div>
          ) : null}
        </main>
      )}

      {/* -------------------- HISTORY SIDE DRAWER -------------------- */}
      {isHistoryOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setIsHistoryOpen(false)}
        />
      )}

      <aside className={`fixed top-0 right-0 z-50 h-screen w-96 max-w-full bg-[#080811]/95 border-l border-slate-800/80 shadow-2xl p-6 flex flex-col transition-transform duration-300 transform ${
        isHistoryOpen ? "translate-x-0" : "translate-x-full"
      }`}>
        <div className="flex items-center justify-between border-b border-slate-900 pb-4 mb-6">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-indigo-400" />
            <h2 className="text-md font-bold text-slate-200">Pitch History</h2>
          </div>
          <button
            onClick={() => setIsHistoryOpen(false)}
            className="h-8 w-8 rounded-lg hover:bg-slate-900 flex items-center justify-center text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* History Sessions List */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-1">
          {savedSessions.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4">
              <History className="h-10 w-10 text-slate-700 mb-3" />
              <p className="text-sm font-semibold text-slate-405">No Saved Sessions</p>
              <p className="text-xs text-slate-500 mt-1.5 max-w-[200px]">
                Your boardroom pitches will be automatically saved here once you complete them.
              </p>
            </div>
          ) : (
            savedSessions.map((session) => {
              const isSelected = loadedSessionId === session.id;
              const hasScorecard = !!session.scorecard;
              const decision = session.scorecard?.decision;

              return (
                <div
                  key={session.id}
                  onClick={() => handleLoadSession(session)}
                  className={`p-4 rounded-xl border transition-all text-left cursor-pointer flex flex-col gap-2.5 relative group ${
                    isSelected
                      ? "bg-indigo-950/20 border-indigo-500/80 active-glow"
                      : "bg-slate-900/30 border-slate-900 hover:bg-slate-900/50 hover:border-slate-800"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-200 group-hover:text-indigo-300 transition-colors">
                        {session.startupProfile.name}
                      </h4>
                      <p className="text-[10px] font-medium text-slate-500 mt-0.5">{session.timestamp}</p>
                    </div>

                    <button
                      onClick={(e) => handleDeleteSession(session.id, e)}
                      className="opacity-0 group-hover:opacity-100 h-6 w-6 rounded-md hover:bg-slate-850 hover:text-rose-455 text-slate-500 transition-all flex items-center justify-center cursor-pointer"
                      title="Delete Session"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {session.startupProfile.oneLiner}
                  </p>

                  <div className="flex items-center justify-between border-t border-slate-950 pt-2.5 mt-1">
                    <span className="text-[9px] px-2 py-0.5 rounded font-black uppercase bg-slate-950 border border-slate-900 text-slate-400">
                      {session.engine === "gemini" ? "Gemini" : session.modelName || "Ollama"}
                    </span>

                    {hasScorecard && decision ? (
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                        decision === "Invest"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : decision === "Pass"
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}>
                        {decision}
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-slate-900 border border-slate-850 text-indigo-400">
                        In Progress
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Clear All & New Pitch Drawer Buttons */}
        <div className="border-t border-slate-900 pt-4 mt-4 flex gap-3 shrink-0">
          {loadedSessionId && (
            <button
              onClick={() => {
                handleReset();
                setIsHistoryOpen(false);
              }}
              className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-slate-950 font-bold rounded-lg text-xs transition-all text-center cursor-pointer text-slate-950"
            >
              New Pitch
            </button>
          )}
          {savedSessions.length > 0 && (
            <button
              onClick={handleClearAllHistory}
              className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-400 border border-slate-850 hover:border-rose-550/20 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

// A simple dummy interface so Recharts elements do not break if ShieldAlert isn't imported
function ShieldAlert(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

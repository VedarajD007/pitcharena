import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ollamaUrl = searchParams.get("url") || "http://localhost:11434";

  try {
    const res = await fetch(`${ollamaUrl}/api/tags`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      // Set a short timeout so the UI doesn't hang if Ollama isn't running
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) {
      throw new Error(`Ollama returned status ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Could not connect to Ollama. Make sure it is running locally.", details: error.message },
      { status: 503 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url = "http://localhost:11434", model, messages, systemPrompt, temperature = 0.7, options = {} } = body;

    if (!model) {
      return NextResponse.json({ error: "Missing 'model' parameter" }, { status: 400 });
    }

    // Prepare messages for Ollama API
    const ollamaMessages = [];

    // Add system instruction if present
    if (systemPrompt) {
      ollamaMessages.push({
        role: "system",
        content: systemPrompt,
      });
    }

    // Add conversation history
    for (const msg of messages) {
      const role = msg.sender === "founder" ? "user" : "assistant";
      ollamaMessages.push({
        role,
        content: msg.text,
      });
    }

    // Query Ollama API
    const response = await fetch(`${url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: ollamaMessages,
        stream: false,
        options: {
          temperature,
          num_predict: 400, // Limit predicted tokens by default for faster CPU generation
          ...options,
        },
        format: "json",
      }),
      signal: AbortSignal.timeout(180000), // Give local LLMs up to 180s (3 minutes) to load and respond
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Ollama server returned error: ${response.statusText}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error in Ollama proxy:", error);
    return NextResponse.json(
      { error: "Failed to generate content with local Ollama.", details: error.message },
      { status: 500 }
    );
  }
}

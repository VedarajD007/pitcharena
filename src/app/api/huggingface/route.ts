import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { model, messages, systemPrompt, temperature = 0.7, token, maxTokens = 250 } = body;

    if (!model) {
      return NextResponse.json({ error: "Missing 'model' parameter" }, { status: 400 });
    }
    if (!token) {
      return NextResponse.json({ error: "Missing Hugging Face API Token" }, { status: 400 });
    }

    // Format messages for OpenAI-compatible chat format
    const hfMessages = [];

    // Add system instructions if present
    if (systemPrompt) {
      hfMessages.push({
        role: "system",
        content: systemPrompt,
      });
    }

    // Add conversation history
    for (const msg of messages) {
      const role = msg.sender === "founder" ? "user" : "assistant";
      hfMessages.push({
        role,
        content: msg.text,
      });
    }

    const endpointUrl = `https://api-inference.huggingface.co/models/${model}/v1/chat/completions`;

    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: hfMessages,
        temperature,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(60000), // 60 seconds timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Hugging Face API returned error: ${response.statusText}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error in Hugging Face proxy:", error);
    return NextResponse.json(
      { error: "Failed to generate content with Hugging Face.", details: error.message },
      { status: 500 }
    );
  }
}

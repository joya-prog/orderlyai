// Reference: javascript_openai blueprint
import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateAgentResponse(
  systemPrompt: string,
  greetingMessage: string,
  personality: string,
  knowledgeContext: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
  userMessage: string
): Promise<string> {
  try {
    const fullSystemPrompt = `${systemPrompt}

PERSONALITY: ${personality}

GREETING: When starting a conversation, use this greeting: "${greetingMessage}"

KNOWLEDGE BASE:
${knowledgeContext}

You are a helpful restaurant AI assistant. Use the knowledge base to answer questions accurately. Be conversational and helpful.`;

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: fullSystemPrompt },
    ];

    // Add conversation history
    if (conversationHistory.length === 0) {
      // First message - include greeting
      messages.push({ role: "assistant", content: greetingMessage });
    } else {
      conversationHistory.forEach((msg) => {
        messages.push({ role: msg.role, content: msg.content });
      });
    }

    // Add current user message
    messages.push({ role: "user", content: userMessage });

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages,
      max_completion_tokens: 500,
    });

    return response.choices[0].message.content || "I apologize, I couldn't generate a response.";
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw new Error("Failed to generate agent response");
  }
}

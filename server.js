// server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(express.json());
app.use(express.static("public")); // serve frontend files

// ----- HELPERS -----
function getToneInstruction(tone) {
  switch ((tone || "").toLowerCase()) {
    case "persuasive":
      return "Use a persuasive, confident, results-focused tone.";
    case "exaggerating":
      return "Use a bold, slightly hyped tone with strong energy, but still professional and believable.";
    case "friendly":
      return "Use a warm, friendly, relaxed tone.";
    case "formal":
      return "Use a formal, respectful, business tone.";
    case "direct":
      return "Use a very direct, straight-to-the-point tone.";
    default:
      return "Use a professional, human-to-human tone.";
  }
}

function getGoalInstruction(goal) {
  switch ((goal || "").toLowerCase()) {
    case "get_whatsapp":
      return "Your main goal is to politely get the store owner’s WhatsApp number or best direct contact.";
    case "book_call":
      return "Your main goal is to book a quick call or voice chat and agree on a time.";
    case "explain_offer":
      return "Your main goal is to clearly explain your performance-based offer so they understand and feel safe.";
    case "close_deal":
      return "Your main goal is to move them closer to saying yes and starting the collaboration.";
    default:
      return "Your main goal is to keep the conversation moving and make it easy for them to respond.";
  }
}

function getLengthInstruction(length) {
  switch ((length || "").toLowerCase()) {
    case "short":
      return "Keep the reply short and sharp: 5–8 concise sentences.";
    case "medium":
      return "Write a medium-length reply: around 2–3 short paragraphs.";
    case "long":
      return "Write a longer reply: 3–5 short paragraphs, but avoid being boring or repetitive.";
    default:
      return "Write a medium-length reply: around 2–3 short paragraphs.";
  }
}

// ----- MAIN ENDPOINT -----
app.post("/api/generate-reply", async (req, res) => {
  try {
    const {
      scoutingMessage,
      storeOwnerReply,
      storeUrl,
      storeName,
      tone,
      replyName,
      salesProofUrls,
      portfolioUrls,
      extraNotes,
      goal,
      length,
      conversationHistory = [],
      salespersonProfile = {},
    } = req.body;

    if (!scoutingMessage || !storeOwnerReply) {
      return res.status(400).json({
        error: "scoutingMessage and storeOwnerReply are required",
      });
    }

    const toneInstruction = getToneInstruction(tone);
    const goalInstruction = getGoalInstruction(goal);
    const lengthInstruction = getLengthInstruction(length);

    const proofText = `
Sales proof URLs (mention them generally, not as a long list):
${(salesProofUrls || []).join(", ") || "None provided"}

Portfolio URLs (you can mention you have a portfolio if needed):
${(portfolioUrls || []).join(", ") || "None provided"}
    `.trim();

    const profileText = `
Salesperson profile:
- Name: ${salespersonProfile.name || "not specified"}
- Agency / brand: ${salespersonProfile.agency || "not specified"}
- Role: ${salespersonProfile.role || "not specified"}
- Signature to use at the end (if natural in the language): ${salespersonProfile.signature || "none"}
    `.trim();

    const systemPrompt = `
You are a professional copywriter who writes WhatsApp / email style replies for a salesperson
who works with e-commerce store owners.

IMPORTANT STYLE RULES:
- The reply must sound 100% human, like a real salesperson writing on their phone or laptop.
- Vary sentence length and structure. Mix short lines with slightly longer explanations.
- Do NOT use generic AI phrases like:
  "As an AI language model", "according to my training", "I don't have access", etc.
- Do NOT say that the text was generated or mention that you are an AI.
- You MAY mention that the salesperson uses AI-based systems or funnels, but only naturally and when it helps the pitch.

LANGUAGE RULE:
- First, detect the language of the STORE OWNER REPLY.
- Then reply ENTIRELY in that language (German in → German out, French → French, etc.).
- Do NOT state which language you detected. Just write in it.
- If the message mixes languages, choose the one that dominates.

GOAL & SHAPE:
${toneInstruction}
${goalInstruction}
${lengthInstruction}

CONTEXT:
Reply name (for your context, do NOT write this in the message): ${replyName || "not specified"}
Store name (if provided): ${storeName || "not provided"}
Store URL (if provided): ${storeUrl || "not provided"}

${profileText}

Additional material you can reference:
${proofText}

Extra notes from the user (if any, you may integrate them naturally):
${extraNotes || "None"}

CONVERSATION:
You will receive previous conversation turns (user = store owner or salesperson, assistant = previous replies).
Use them as context to keep the same style and logic.
At the end of the message, if a signature is provided in the profile, you may include a short closing line plus their name/agency,
but keep it natural in the detected language.

Your output:
- ONE single reply message that the salesperson can send to the store owner.
- No headers like "Subject:", "From:", "To:". Just the message body.
- Use natural line breaks as in a WhatsApp or email message.
    `.trim();

    const userPrompt = `
This is the original scouting / reachout message the salesperson sent:

"${scoutingMessage}"

This is the latest store owner's message:

"${storeOwnerReply}"

Write the next reply in the conversation, following all rules above.
Do NOT add labels like "Subject:", "From:", etc. Just the message body.
    `.trim();

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
      { role: "user", content: userPrompt },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini", // you can upgrade model here if you want
      messages,
      temperature: 0.85,
      top_p: 0.9,
    });

    const aiReply = completion.choices?.[0]?.message?.content?.trim();

    if (!aiReply) {
      return res.status(500).json({ error: "No reply generated" });
    }

    res.json({ reply: aiReply });
  } catch (err) {
    console.error("Error generating reply:", err);
    res.status(500).json({ error: "Failed to generate reply" });
  }
});

// ----- START SERVER -----
app.listen(PORT, () => {
  console.log(`Reply AI server running on http://localhost:${PORT}`);
});
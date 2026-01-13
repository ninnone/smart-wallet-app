import { getGeminiAdvice } from "./ai-service.js";

const CATEGORY_KEYWORDS = {
  salary: ["salary", "payment", "payroll", "income", "wage", "bonus"],
  food: [
    "restaurant",
    "food",
    "groceries",
    "cafe",
    "lunch",
    "dinner",
    "breakfast",
    "market",
  ],
  transport: [
    "taxi",
    "uber",
    "bus",
    "fuel",
    "gas",
    "parking",
    "transport",
    "flight",
    "ticket",
  ],
  health: [
    "hospital",
    "pharmacy",
    "doctor",
    "medical",
    "health",
    "clinic",
    "medicine",
    "dental",
  ],
  entertainment: [
    "cinema",
    "movie",
    "game",
    "spotify",
    "netflix",
    "entertainment",
    "concert",
    "show",
  ],
  utilities: [
    "electricity",
    "water",
    "internet",
    "phone",
    "gas",
    "bills",
    "utility",
  ],
  shopping: [
    "mall",
    "store",
    "amazon",
    "shopping",
    "clothes",
    "store",
    "retail",
  ],
};

export async function extractCategoryFromText(text) {
  const lowerText = text.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lowerText.includes(kw))) {
      return category;
    }
  }

  try {
    const prompt = `Categorize this receipt/invoice text into ONE category only. Categories: salary, food, transport, health, entertainment, utilities, shopping, other.

Receipt text: "${text.substring(0, 300)}"

Respond with only the category name, nothing else.`;

    const API_KEY = "AIzaSyD2neI_xwF3Z3g-eAk9MDuef-xjioEhYbE";
    const model = "gemini-2.5-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

    const response = await fetch(
      endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      if (data && data.candidates && data.candidates.length > 0) {
        const category = data.candidates[0].content.parts[0].text.trim().toLowerCase();
        return [
          "salary",
          "food",
          "transport",
          "health",
          "entertainment",
          "utilities",
          "shopping",
          "other",
        ].includes(category)
          ? category
          : "other";
      }
    }
  } catch (error) {
    console.log(" AI categorization failed, using keywords:", error);
  }

  return "other";
}

export async function extractDocumentType(text) {
  const lowerText = text.toLowerCase();

  if (
    lowerText.includes("salary") ||
    lowerText.includes("payroll") ||
    lowerText.includes("pay")
  )
    return "payslip";
  if (
    lowerText.includes("invoice") ||
    lowerText.includes("bill") ||
    lowerText.includes("invoice #")
  )
    return "invoice";
  if (
    lowerText.includes("receipt") ||
    lowerText.includes("total") ||
    lowerText.includes("items")
  )
    return "receipt";
  if (
    lowerText.includes("statement") ||
    lowerText.includes("balance") ||
    lowerText.includes("account")
  )
    return "statement";

  return "unknown";
}

export async function enhanceExtraction(text, amount) {
  return {
    documentType: await extractDocumentType(text),
    category: await extractCategoryFromText(text),
    suggestedDescription: text.substring(0, 100).trim(),
    confidence: "high",
  };
}

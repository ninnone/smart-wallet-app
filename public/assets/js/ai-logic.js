var model = "gemini-2.5-flash";
var apiKey = "AIzaSyD2neI_xwF3Z3g-eAk9MDuef-xjioEhYbE";
var GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey;


export function getFinancialAdvice(income, expenses, savings) {

    if (typeof income === 'object' && income !== null) {
        var metrics = income;
        income = metrics.totalIncome || metrics.income || 0;
        expenses = metrics.totalExpenses || metrics.expenses || 0;
        savings = metrics.totalSavings || metrics.savings || 0;
    }

    var prompt = "Analyze this wallet: Income [" + income + "], Expenses [" + expenses + "], Savings [" + savings + "]. Give 3 short, localized savings tips for someone in Cameroon. Detect if spending is too high in specific categories.";

    var payload = {
        contents: [{
            parts: [{ text: prompt }]
        }]
    };

    return fetch(GEMINI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
        .then(function (response) {
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.error?.message || response.statusText); });
            }
            return response.json();
        })
        .then(function (data) {
            if (data && data.candidates && data.candidates.length > 0) {
                return data.candidates[0].content.parts[0].text;
            }
            return getFallbackFinancialAdvice(income, expenses, savings);
        })
        .catch(function (error) {
            console.error("AI Advice Error:", error);
            return getFallbackFinancialAdvice(income, expenses, savings);
        });
}

function getFallbackFinancialAdvice(income, expenses, savings) {
    var tips = [];
    var balance = income - expenses;
    var saveRate = income > 0 ? (savings / income) * 100 : 0;

    if (income === 0 && expenses === 0) {
        return "Add some transactions to get personalized advice! 🚀";
    }

    if (balance < 0) {
        tips.push("Warning: Your expenses exceed your income. Consider reviewing your non-essential spending.");
    }

    if (saveRate < 10) {
        tips.push(" Tip: Try to set aside at least 10% of your income for emergencies.");
    } else {
        tips.push(" Great job on saving! Keep building your financial cushion.");
    }

    tips.push(" Tip: Use the 'Analysis' page to see which categories consume most of your budget.");

    return "<b>AI Insight (Offline Mode):</b><br>" + tips.join("<br>");
}


export function predictLoanImpact(amount, deadline, currentSavings) {
    var prompt = "If I have [" + currentSavings + "] and take a loan of [" + amount + "] with a deadline of [" + deadline + "], how will this impact my future savings? Provide a 2-sentence prediction.";

    var payload = {
        contents: [{
            parts: [{ text: prompt }]
        }]
    };

    return fetch(GEMINI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
        .then(function (response) {
            return response.json();
        })
        .then(function (data) {
            if (data && data.candidates && data.candidates.length > 0) {
                return data.candidates[0].content.parts[0].text;
            }
            return "Prediction currently unavailable.";
        })
        .catch(function (error) {
            console.error("Loan Prediction Error:", error);
            return "Error predicting loan impact.";
        });
}


export function refineOCRWithAI(rawText) {
    var prompt = "Extract the Amount, Merchant Name, and Date from this Cameroon receipt text: [" + rawText + "]. Return JSON format: {amount: number, category: string, date: string, merchant: string}.";

    var payload = {
        contents: [{
            parts: [{ text: prompt }]
        }]
    };

    return fetch(GEMINI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
        .then(function (response) {
            return response.json();
        })
        .then(function (data) {
            if (data && data.candidates && data.candidates.length > 0) {
                var textResult = data.candidates[0].content.parts[0].text;

                var jsonMatch = textResult.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    try {
                        return JSON.parse(jsonMatch[0]);
                    } catch (e) {
                        console.error("JSON Parse Error:", e);
                    }
                }
            }
            return null;
        })
        .catch(function (error) {
            console.error("AI OCR Error:", error);
            return null;
        });
}

export function getDebtToIncomeAdvice(income, totalDebt) {
    var prompt = "My monthly income is " + income + " XAF and my total debt is " + totalDebt + " XAF. Provide a short advice on my debt-to-income ratio.";

    var payload = {
        contents: [{ parts: [{ text: prompt }] }]
    };

    return fetch(GEMINI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data && data.candidates && data.candidates.length > 0) {
                return data.candidates[0].content.parts[0].text;
            }
            return "Ratio advice unavailable.";
        });
}

export function getSavingsPercentageSuggestion(income, expenses) {
    var prompt = "Based on monthly income of " + income + " XAF and expenses of " + expenses + " XAF, suggest a specific percentage to save this month. Return ONLY the number (e.g., 15).";

    var payload = {
        contents: [{ parts: [{ text: prompt }] }]
    };

    return fetch(GEMINI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data && data.candidates && data.candidates.length > 0) {
                return data.candidates[0].content.parts[0].text.trim();
            }
            return "15";
        });
}

export function getBudgetAlertAI(income, expenses) {
    var prompt = "URGENT: Income " + income + " XAF, Expenses " + expenses + " XAF. The user has exceeded 80% of their income. Give a 1-sentence forceful financial warning with a localized Cameroon tip.";

    var payload = {
        contents: [{ parts: [{ text: prompt }] }]
    };

    return fetch(GEMINI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data && data.candidates && data.candidates.length > 0) {
                return data.candidates[0].content.parts[0].text;
            }
            return "Risk of Deficit Detected. Please reduce non-essential spending.";
        });
}
export var getSmartAdvice = getFinancialAdvice;

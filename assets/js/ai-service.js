const API_KEY = "AIzaSyD2neI_xwF3Z3g-eAk9MDuef-xjioEhYbE";
const model = "gemini-2.5-flash";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

export async function getGeminiAdvice(metrics) {
  if (!API_KEY) {
    console.warn(' Gemini API key not configured. Using fallback advice.');
    return getFallbackAdvice(metrics);
  }

  try {
    const prompt = buildFinancialPrompt(metrics);

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      console.error(' Gemini API error:', response.status);
      return getFallbackAdvice(metrics);
    }

    const data = await response.json();
    if (data && data.candidates && data.candidates.length > 0) {
      const advice = data.candidates[0].content.parts[0].text;
      console.log(' Gemini advice received:', advice);
      return advice;
    }

    return getFallbackAdvice(metrics);
  } catch (error) {
    console.error(' Error calling Gemini API:', error);
    return getFallbackAdvice(metrics);
  }
}

function buildFinancialPrompt(metrics) {
  const {
    totalIncome = 0,
    totalExpenses = 0,
    totalSavings = 0,
    loans = 0,
    period = 'monthly',
    categoryBreakdown = {},
    language = 'en'
  } = metrics;

  const balance = totalIncome - totalExpenses + totalSavings;
  const savingRate = totalIncome > 0 ? ((totalSavings / totalIncome) * 100).toFixed(1) : 0;
  const expenseRate = totalIncome > 0 ? ((totalExpenses / totalIncome) * 100).toFixed(1) : 0;

  const languagePrompt = language === 'fr'
    ? 'Veuillez fournir des conseils financiers en français.'
    : 'Please provide financial advice in English.';

  let categoryText = language === 'fr' ? 'Principales catégories de dépenses: ' : 'Top expense categories: ';
  if (Object.keys(categoryBreakdown).length > 0) {
    const sorted = Object.entries(categoryBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat, amt]) => `${cat}: ${amt.toFixed(0)} XAF`)
      .join(', ');
    categoryText += sorted;
  } else {
    categoryText += language === 'fr' ? 'Aucune enregistrée.' : 'None recorded yet.';
  }

  if (language === 'fr') {
    return `
${languagePrompt}

J'ai besoin de conseils financiers basés sur mes métriques financières ${period === 'monthly' ? 'mensuelles' : period === 'weekly' ? 'hebdomadaires' : period === 'yearly' ? 'annuelles' : 'quotidiennes'}:

Résumé financier:
- Revenu total: ${totalIncome.toFixed(0)} XAF
- Dépenses totales: ${totalExpenses.toFixed(0)} XAF
- Épargne totale: ${totalSavings.toFixed(0)} XAF
- Solde du compte: ${balance.toFixed(0)} XAF
- Taux d'épargne: ${savingRate}%
- Taux de dépenses: ${expenseRate}%
- Prêts en cours: ${loans.toFixed(0)} XAF

${categoryText}

Veuillez fournir 2-3 recommandations financières spécifiques et actionnables pour améliorer ma santé financière.
    `.trim();
  }

  return `
${languagePrompt}

I need financial advice based on my ${period} financial metrics:

Financial Summary:
- Total Income: ${totalIncome.toFixed(0)} XAF
- Total Expenses: ${totalExpenses.toFixed(0)} XAF
- Total Savings: ${totalSavings.toFixed(0)} XAF
- Account Balance: ${balance.toFixed(0)} XAF
- Saving Rate: ${savingRate}%
- Expense Rate: ${expenseRate}%
- Outstanding Loans: ${loans.toFixed(0)} XAF

${categoryText}

Please provide 2-3 specific, actionable financial recommendations to improve my financial health.
  `.trim();
}

function getFallbackAdvice(metrics) {
  const {
    totalIncome = 0,
    totalExpenses = 0,
    totalSavings = 0,
    language = 'en'
  } = metrics;

  const savingRate = totalIncome > 0 ? (totalSavings / totalIncome * 100) : 0;
  const expenseRate = totalIncome > 0 ? (totalExpenses / totalIncome * 100) : 0;

  let advice = [];

  if (language === 'fr') {
    if (savingRate < 10 && totalIncome > 0) {
      advice.push(' Essayez d\'économiser au moins 10-20% de vos revenus pour les urgences et les objectifs à long terme.');
    }

    if (expenseRate > 70) {
      advice.push(' Vos dépenses sont élevées (plus de 70% des revenus). Envisagez de réduire les dépenses non essentielles.');
    }

    if (totalExpenses > totalIncome) {
      advice.push(' Critique: Vous dépensez plus que vous ne gagnez. Révisez votre budget immédiatement.');
    } else if (totalIncome > 0 && expenseRate < 50) {
      advice.push(' Excellent! Vos dépenses sont bien contrôlées. Continuez à maintenir cette discipline.');
    }

    if (advice.length === 0 && totalIncome > 0) {
      advice.push(' Ajoutez plus de transactions pour obtenir des informations financières et des recommandations plus détaillées.');
    }
  } else {
    if (savingRate < 10 && totalIncome > 0) {
      advice.push(' Try to save at least 10-20% of your income for emergencies and long-term goals.');
    }

    if (expenseRate > 70) {
      advice.push(' Your expenses are high (over 70% of income). Consider cutting down on non-essential spending.');
    }

    if (totalExpenses > totalIncome) {
      advice.push(' Critical: You are spending more than you earn. Review your budget immediately.');
    } else if (totalIncome > 0 && expenseRate < 50) {
      advice.push(' Excellent! Your spending is well-controlled. Keep maintaining this discipline.');
    }

    if (advice.length === 0 && totalIncome > 0) {
      advice.push(' Add more transactions to get more detailed financial insights and recommendations.');
    }
  }

  return advice.join('\n\n');
}
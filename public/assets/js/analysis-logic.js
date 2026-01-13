import { getTransactions, getLoans, getSavingsGoals, initDatabase } from './database.js';
import { getTranslation } from './i18n.js';
import { getSavingsPercentageSuggestion, getDebtToIncomeAdvice, getFinancialAdvice, getBudgetAlertAI } from './ai-logic.js';

export function runGlobalAnalysis() {
    var currentUser = localStorage.getItem('currentUser');
    if (!currentUser) return;

    getTransactions(currentUser).then(function (transactions) {
        var totalIncome = 0;
        var totalExpenses = 0;
        var categoryTotals = {};

        transactions.forEach(function (t) {
            var amount = parseFloat(t.amount) || 0;
            if (t.type === 'income') {
                totalIncome += amount;
            } else if (t.type === 'expense') {
                totalExpenses += amount;
                if (!categoryTotals[t.category]) {
                    categoryTotals[t.category] = 0;
                }
                categoryTotals[t.category] += amount;
            }
        });

        checkBudgetHealth(totalIncome, totalExpenses);

        getSavingsGoals(currentUser).then(function (activeGoals) {
            if (typeof getFinancialAdvice === 'function') {
                var totalSavings = transactions.filter(function (t) { return t.type === 'savings'; })
                    .reduce(function (sum, t) { return sum + (parseFloat(t.amount) || 0); }, 0);

                getFinancialAdvice(totalIncome, totalExpenses, totalSavings).then(function (advice) {
                    var displayElement = document.getElementById('ai-advice-display');
                    if (displayElement) {
                        displayElement.innerHTML = advice.replace(/\n/g, '<br>');
                    }
                });
            }
        });

        var leisureSpending = categoryTotals['Entertainment'] || categoryTotals['Leisure'] || 0;
        if (totalIncome > 0 && (leisureSpending / totalIncome) > 0.40) {
            var alertDiv = document.getElementById('leisure-alert');
            if (alertDiv) {
                alertDiv.textContent = "Warning: Leisure spending exceeds 40% of your income!";
                alertDiv.classList.remove('hidden');
            }
        }

        if (typeof getSavingsPercentageSuggestion === 'function') {
            getSavingsPercentageSuggestion(totalIncome, totalExpenses).then(function (suggestion) {
                var suggestionDiv = document.getElementById('ai-savings-suggestion');
                if (suggestionDiv) {
                    var percent = suggestion.toString().replace(/[^0-9.]/g, '') || "15";
                    suggestionDiv.textContent = "AI Suggestion: Save at least " + percent + "% of your income.";
                }
            });
        }

        if (typeof updateGlobalCharts === 'function') {
            updateGlobalCharts(totalIncome, totalExpenses, categoryTotals);
        }
    });
}

export function checkBudgetHealth(income, expenses) {
    if (income > 0 && expenses > (income * 0.80)) {
        if (typeof getBudgetAlertAI === 'function') {
            getBudgetAlertAI(income, expenses).then(function (warning) {
                var alertContainer = document.getElementById('budget-risk-alert');
                var alertText = document.getElementById('budget-risk-text');
                if (alertContainer && alertText) {
                    alertText.textContent = warning;
                    alertContainer.classList.remove('hidden');
                } else {
                    window.alert("Risk of Deficit Detected: " + warning);
                }
            });
        }
    }
}

export function checkLoanDeadlines() {
    var currentUser = localStorage.getItem('currentUser');
    if (!currentUser) return;

    getLoans(currentUser).then(function (loans) {
        var today = new Date();
        var urgentLoans = [];
        var totalDebt = 0;

        loans.forEach(function (l) {
            if (l.status !== 'paid') {
                totalDebt += parseFloat(l.amount) || 0;
                var deadline = new Date(l.dueDate);
                if (deadline < today) {
                    urgentLoans.push(l);
                }
            }
        });

        if (urgentLoans.length > 0) {
            var deadlineDisplay = document.getElementById('deadline-alerts');
            if (deadlineDisplay) {
                deadlineDisplay.innerHTML = "<strong>Unpaid Loans Past Due:</strong> " + urgentLoans.length;
                deadlineDisplay.classList.remove('hidden');
            }
        }

        getTransactions(currentUser).then(function (transactions) {
            var income = 0;
            transactions.forEach(function (t) {
                if (t.type === 'income') income += parseFloat(t.amount) || 0;
            });

            if (typeof getDebtToIncomeAdvice === 'function') {
                getDebtToIncomeAdvice(income, totalDebt).then(function (advice) {
                    var adviceDiv = document.getElementById('debt-advice-display');
                    if (adviceDiv) {
                        adviceDiv.textContent = advice;
                    }
                });
            }
        });
    });
}

export function updateGlobalCharts(income, expenses, categoryTotals) {
    var currentUser = localStorage.getItem('currentUser');
    if (!currentUser) return;

    getTransactions(currentUser).then(function (transactions) {
        var now = new Date();
        var currentMonth = now.getMonth();
        var currentYear = now.getFullYear();

        var monthIncome = 0;
        var monthExpenses = 0;
        transactions.forEach(function (t) {
            var d = new Date(t.date);
            if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                var amt = parseFloat(t.amount) || 0;
                if (t.type === 'income') monthIncome += amt;
                else if (t.type === 'expense') monthExpenses += amt;
            }
        });

        var monthSavings = Math.max(0, monthIncome - monthExpenses);
        var savingsGoal = monthIncome * 0.20;
        var percent = savingsGoal > 0 ? Math.min(100, (monthSavings / savingsGoal) * 100) : 0;

        var bar = document.getElementById('cssSavingsBar');
        var pctText = document.getElementById('cssSavingsPercent');
        var goalLabel = document.getElementById('savingsGoalLabel');
        var statusBadge = document.getElementById('savingsStatusBadge');

        if (bar) bar.style.width = percent + '%';
        if (pctText) pctText.textContent = Math.round(percent) + '%';
        if (goalLabel) goalLabel.textContent = "Goal: " + savingsGoal.toFixed(0) + " XAF (20%)";

        if (statusBadge) {
            if (percent >= 100) {
                statusBadge.textContent = 'Goal Reached!';
                statusBadge.className = 'insight-badge badge-success';
            } else if (percent >= 50) {
                statusBadge.textContent = 'On Track';
                statusBadge.className = 'insight-badge badge-info';
            } else {
                statusBadge.textContent = 'Below Goal';
                statusBadge.className = 'insight-badge badge-warning';
            }
        }

        var aiCtx = document.getElementById('aiPredictionChart');
        if (aiCtx && window.Chart) {
            if (window.aiPredictionChartInstance) window.aiPredictionChartInstance.destroy();

            var ctx = aiCtx.getContext('2d');
            var gradient = ctx.createLinearGradient(0, 0, 0, 400);
            gradient.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
            gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');

            var projectionSavings = monthSavings * 1.15;

            window.aiPredictionChartInstance = new Chart(aiCtx, {
                type: 'line',
                data: {
                    labels: ['Current Month', 'Next Month (AI Proj.)'],
                    datasets: [
                        {
                            label: 'Projected Savings',
                            data: [monthSavings, projectionSavings],
                            borderColor: '#10b981',
                            backgroundColor: gradient,
                            fill: true,
                            tension: 0.4,
                            pointRadius: 8,
                            pointBackgroundColor: '#10b981',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 3,
                            pointHoverRadius: 10,
                            borderWidth: 4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: '#10b981',
                            titleFont: { size: 14, weight: 'bold' },
                            bodyFont: { size: 14 },
                            padding: 12,
                            displayColors: false,
                            callbacks: {
                                label: function (context) { return context.parsed.y.toFixed(0) + " XAF"; }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(0,0,0,0.05)' },
                            ticks: { font: { weight: '600', size: 12 } }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { font: { weight: '700', size: 14 } }
                        }
                    }
                }
            });
        }
    });

    var pieCtx = document.getElementById('categoryPieChart');
    if (pieCtx && window.Chart && !window.analysisPageActive) {
        var labels = Object.keys(categoryTotals);
        var data = Object.values(categoryTotals);

        if (window.aiPieChart) window.aiPieChart.destroy();

        window.aiPieChart = new Chart(pieCtx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: ['#2B9FD9', '#2F5F87', '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
}

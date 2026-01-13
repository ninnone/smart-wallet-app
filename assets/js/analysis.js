import { getTransactions, initDatabase, getCurrentUser, logout } from './database.js';
import { runGlobalAnalysis } from './analysis-logic.js';

let charts = {};
let currentPeriod = 'monthly';
let customStartDate = null;
let customEndDate = null;

document.addEventListener('DOMContentLoaded', function () {
  window.analysisPageActive = true;
  initDatabase().then(function () {
    var currentUser = getCurrentUser();
    if (!currentUser) {
      window.location.href = '../../index.html';
      return;
    }

    document.getElementById('userName').textContent = currentUser;

    var logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        logout();
        window.location.href = '../../index.html';
      });
    }

    var startDateInput = document.getElementById('startDate');
    var endDateInput = document.getElementById('endDate');

    startDateInput.addEventListener('change', function () {
      customStartDate = startDateInput.value ? new Date(startDateInput.value) : null;
      if (customStartDate && customEndDate && customStartDate <= customEndDate) {
        currentPeriod = 'custom';
        loadAnalysis();
      }
    });

    endDateInput.addEventListener('change', function () {
      customEndDate = endDateInput.value ? new Date(endDateInput.value) : null;
      if (customStartDate && customEndDate && customStartDate <= customEndDate) {
        currentPeriod = 'custom';
        loadAnalysis();
      }
    });

    document.querySelectorAll('.period-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        document.querySelectorAll('.period-btn').forEach(function (b) {
          b.classList.remove('active');
        });
        e.target.classList.add('active');
        currentPeriod = e.target.dataset.period;
        customStartDate = null;
        customEndDate = null;
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';
        loadAnalysis();
      });
    });

    loadAnalysis();
  });
});

function loadAnalysis() {
  var currentUser = getCurrentUser();
  getTransactions(currentUser).then(function (allTransactions) {
    var totalIncome = 0;
    var totalExpenses = 0;
    allTransactions.forEach(function (t) {
      var amt = parseFloat(t.amount) || 0;
      if (t.type === 'income') totalIncome += amt;
      else if (t.type === 'expense') totalExpenses += amt;
    });
    var absoluteBalance = totalIncome - totalExpenses;
    var headerBalance = document.getElementById('headerBalance');
    if (headerBalance) {
      headerBalance.textContent = absoluteBalance.toFixed(0) + ' XAF';
    }

    var filteredTransactions = filterTransactionsByPeriod(allTransactions);
    var periodData = aggregateByPeriod(filteredTransactions);
    var categoryData = aggregateByCategory(filteredTransactions);

    updateMetrics(periodData, filteredTransactions);
    updateCharts(periodData, categoryData, filteredTransactions);
    updateCategoryAnalysis(categoryData);
    updateFinancialHealth(periodData, filteredTransactions);
    updateSmartInsights(periodData, categoryData, filteredTransactions);
    updateSpendingPatterns(filteredTransactions);

    runGlobalAnalysis();
  });
}

function filterTransactionsByPeriod(transactions) {
  return transactions.filter(trans => {
    const date = new Date(trans.date);

    if (currentPeriod === 'custom') {
      if (customStartDate && customEndDate) {
        return date >= customStartDate && date <= customEndDate;
      }
      return true;
    }

    const now = new Date();
    const daysDiff = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    switch (currentPeriod) {
      case 'daily': return daysDiff < 1;
      case 'weekly': return daysDiff < 7;
      case 'monthly': return daysDiff < 30;
      case 'yearly': return daysDiff < 365;
      default: return true;
    }
  });
}

function aggregateByPeriod(transactions) {
  const periodData = {};

  transactions.forEach(trans => {
    const date = new Date(trans.date);
    let period = '';

    switch (currentPeriod) {
      case 'daily':
        period = date.toLocaleDateString();
        break;
      case 'weekly':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        period = weekStart.toLocaleDateString();
        break;
      case 'monthly':
        period = date.toLocaleString('default', { month: 'short', year: 'numeric' });
        break;
      case 'yearly':
        period = date.getFullYear().toString();
        break;
      case 'custom':
        period = date.toLocaleDateString();
        break;
    }

    if (!periodData[period]) {
      periodData[period] = { income: 0, expenses: 0, savings: 0, transactions: 0 };
    }

    const amount = parseFloat(trans.amount);
    periodData[period].transactions++;

    if (trans.type === 'income') periodData[period].income += amount;
    else if (trans.type === 'expense') periodData[period].expenses += amount;
    else if (trans.type === 'savings') periodData[period].savings += amount;
  });

  return periodData;
}

function aggregateByCategory(transactions) {
  const categoryData = {};

  transactions.forEach(trans => {
    if (trans.type === 'expense') {
      const category = trans.category || 'Other';
      if (!categoryData[category]) {
        categoryData[category] = { amount: 0, count: 0, transactions: [] };
      }
      categoryData[category].amount += parseFloat(trans.amount);
      categoryData[category].count++;
      categoryData[category].transactions.push(trans);
    }
  });

  return categoryData;
}

function updateMetrics(periodData, transactions) {
  const periods = Object.keys(periodData);
  const numPeriods = periods.length || 1;

  const totalIncome = periods.reduce((sum, p) => sum + periodData[p].income, 0);
  const totalExpenses = periods.reduce((sum, p) => sum + periodData[p].expenses, 0);
  const totalSavings = periods.reduce((sum, p) => sum + periodData[p].savings, 0);

  const avgIncome = totalIncome / numPeriods;
  const avgExpenses = totalExpenses / numPeriods;
  const savingsRate = totalIncome > 0 ? ((totalSavings / totalIncome) * 100) : 0;

  const daysCovered = transactions.length > 0 ?
    Math.max(1, Math.ceil((new Date() - new Date(transactions[0].date)) / (1000 * 60 * 60 * 24))) : 1;
  const burnRate = totalExpenses / daysCovered;

  document.getElementById('avgIncome').textContent = `${avgIncome.toFixed(0)} XAF`;
  document.getElementById('avgExpenses').textContent = `${avgExpenses.toFixed(0)} XAF`;
  document.getElementById('savingsRateValue').textContent = `${savingsRate.toFixed(1)}%`;
  document.getElementById('burnRate').textContent = `${burnRate.toFixed(0)} XAF/day`;

  if (periods.length > 1) {
    const recentIncome = periodData[periods[periods.length - 1]].income;
    const previousIncome = periodData[periods[periods.length - 2]].income;
    const incomeTrend = previousIncome > 0 ? ((recentIncome - previousIncome) / previousIncome * 100) : 0;

    const recentExpense = periodData[periods[periods.length - 1]].expenses;
    const previousExpense = periodData[periods[periods.length - 2]].expenses;
    const expenseTrend = previousExpense > 0 ? ((recentExpense - previousExpense) / previousExpense * 100) : 0;

    updateTrendIndicator('incomeTrend', incomeTrend);
    updateTrendIndicator('expenseTrend', expenseTrend);
  }
}

function updateTrendIndicator(elementId, trend) {
  const element = document.getElementById(elementId);
  const arrow = trend > 0 ? '↑' : trend < 0 ? '↓' : '→';
  const className = trend > 0 ? 'trend-up' : trend < 0 ? 'trend-down' : 'trend-neutral';

  element.className = `trend-indicator ${className}`;
  element.innerHTML = `<span>${arrow} ${Math.abs(trend).toFixed(1)}%</span>`;
}

function updateCharts(periodData, categoryData, transactions) {
  destroyAllCharts();

  const periods = Object.keys(periodData).sort();

  charts.incomeExpense = new Chart(document.getElementById('incomeExpenseChart'), {
    type: 'bar',
    data: {
      labels: periods,
      datasets: [
        {
          label: 'Income',
          data: periods.map(p => periodData[p].income),
          backgroundColor: '#10b981',
          borderRadius: 6,
        },
        {
          label: 'Expenses',
          data: periods.map(p => periodData[p].expenses),
          backgroundColor: '#ef4444',
          borderRadius: 6,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: (context) => `${context.dataset.label}: ${context.parsed.y.toFixed(0)} XAF`
          }
        }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });

  const totalIncome = periods.reduce((sum, p) => sum + periodData[p].income, 0);
  const totalExpenses = periods.reduce((sum, p) => sum + periodData[p].expenses, 0);
  const cashFlowBadge = document.getElementById('cashFlowBadge');

  if (totalIncome > totalExpenses) {
    cashFlowBadge.className = 'insight-badge badge-success';
    cashFlowBadge.textContent = 'Positive Cash Flow';
  } else if (totalIncome < totalExpenses) {
    cashFlowBadge.className = 'insight-badge badge-danger';
    cashFlowBadge.textContent = 'Negative Cash Flow';
  } else {
    cashFlowBadge.className = 'insight-badge badge-info';
    cashFlowBadge.textContent = 'Balanced';
  }

  charts.trend = new Chart(document.getElementById('trendChart'), {
    type: 'line',
    data: {
      labels: periods,
      datasets: [
        {
          label: 'Net Cash Flow',
          data: periods.map(p => periodData[p].income - periodData[p].expenses),
          borderColor: '#2B9FD9',
          backgroundColor: 'rgba(43, 159, 217, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#2B9FD9',
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: false }
      }
    }
  });

  const categories = Object.keys(categoryData);
  charts.categoryPie = new Chart(document.getElementById('categoryPieChart'), {
    type: 'doughnut',
    data: {
      labels: categories,
      datasets: [{
        data: categories.map(c => categoryData[c].amount),
        backgroundColor: [
          '#2B9FD9', '#10b981', '#f59e0b', '#ef4444',
          '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'
        ],
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 8 } }
      }
    }
  });

  charts.savings = new Chart(document.getElementById('savingsChart'), {
    type: 'line',
    data: {
      labels: periods,
      datasets: [{
        label: 'Cumulative Savings',
        data: periods.map((p, i) => {
          return periods.slice(0, i + 1).reduce((sum, period) =>
            sum + periodData[period].savings, 0);
        }),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#10b981',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });

  const expenseTransactions = transactions.filter(t => t.type === 'expense');
  const dailyExpenses = {};

  expenseTransactions.forEach(trans => {
    const day = new Date(trans.date).toLocaleDateString('en', { weekday: 'short' });
    dailyExpenses[day] = (dailyExpenses[day] || 0) + parseFloat(trans.amount);
  });

  const daysOrder = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  charts.dailyExpense = new Chart(document.getElementById('dailyExpenseChart'), {
    type: 'polarArea',
    data: {
      labels: daysOrder,
      datasets: [{
        data: daysOrder.map(day => dailyExpenses[day] || 0),
        backgroundColor: [
          'rgba(43, 159, 217, 0.6)',
          'rgba(16, 185, 129, 0.6)',
          'rgba(245, 158, 11, 0.6)',
          'rgba(239, 68, 68, 0.6)',
          'rgba(139, 92, 246, 0.6)',
          'rgba(236, 72, 153, 0.6)',
          'rgba(20, 184, 166, 0.6)'
        ],
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 6 } }
      }
    }
  });
}

function updateCategoryAnalysis(categoryData) {
  const container = document.getElementById('categoryAnalysisContainer');
  container.innerHTML = '';

  if (Object.keys(categoryData).length === 0) {
    container.innerHTML = '<p class="text-gray-500">No expense data available for this period</p>';
    return;
  }

  const sorted = Object.entries(categoryData).sort((a, b) => b[1].amount - a[1].amount);
  const total = sorted.reduce((sum, [_, data]) => sum + data.amount, 0);

  sorted.forEach(([category, data]) => {
    const percentage = (data.amount / total) * 100;
    const avgTransaction = data.amount / data.count;

    const div = document.createElement('div');
    div.className = 'bg-gray-50 rounded-lg p-4 border border-gray-200';
    div.innerHTML = `
      <div class="flex justify-between items-start mb-3">
        <div>
          <h4 class="font-semibold text-gray-900 capitalize text-lg">${category}</h4>
          <p class="text-sm text-gray-600">${data.count} transactions</p>
        </div>
        <div class="text-right">
          <p class="text-2xl font-bold text-gray-900">${data.amount.toFixed(0)} XAF</p>
          <p class="text-sm font-medium text-primary">${percentage.toFixed(1)}%</p>
        </div>
      </div>
      <div class="spending-bar mb-2">
        <div class="spending-bar-fill" style="width: ${percentage}%"></div>
      </div>
      <p class="text-xs text-gray-500">Average per transaction: ${avgTransaction.toFixed(0)} XAF</p>
    `;
    container.appendChild(div);
  });
}

function updateFinancialHealth(periodData, transactions) {
  const periods = Object.keys(periodData);
  const totalIncome = periods.reduce((sum, p) => sum + periodData[p].income, 0);
  const totalExpenses = periods.reduce((sum, p) => sum + periodData[p].expenses, 0);
  const totalSavings = periods.reduce((sum, p) => sum + periodData[p].savings, 0);

  let score = 50; // Base score

  if (totalIncome > 0) {
    const incomeVariance = calculateVariance(periods.map(p => periodData[p].income));
    const incomeAvg = totalIncome / periods.length;
    const stabilityScore = incomeAvg > 0 ? Math.max(0, 20 - (incomeVariance / incomeAvg * 10)) : 0;
    score += stabilityScore;
  }

  const savingsRate = totalIncome > 0 ? (totalSavings / totalIncome) : 0;
  score += Math.min(30, savingsRate * 150);

  if (totalExpenses <= totalIncome * 0.7) {
    score += 20;
  } else if (totalExpenses <= totalIncome) {
    score += 10;
  } else {
    score -= 10;
  }

  score = Math.max(0, Math.min(100, score));

  const circle = document.getElementById('healthScoreCircle');
  const circumference = 339.292;
  const offset = circumference - (score / 100) * circumference;
  circle.style.strokeDashoffset = offset;

  if (score >= 80) {
    circle.style.stroke = '#10b981';
  } else if (score >= 60) {
    circle.style.stroke = '#2B9FD9';
  } else if (score >= 40) {
    circle.style.stroke = '#f59e0b';
  } else {
    circle.style.stroke = '#ef4444';
  }

  document.getElementById('healthScore').textContent = Math.round(score);

  const insightsContainer = document.getElementById('healthInsights');
  insightsContainer.innerHTML = '';

  const insights = [];

  if (score >= 80) {
    insights.push({ text: 'Excellent financial health', type: 'success' });
  } else if (score >= 60) {
    insights.push({ text: 'Good financial management', type: 'info' });
  } else if (score >= 40) {
    insights.push({ text: 'Room for improvement', type: 'warning' });
  } else {
    insights.push({ text: 'Needs immediate attention', type: 'danger' });
  }

  if (savingsRate >= 0.2) {
    insights.push({ text: 'Strong savings habit', type: 'success' });
  } else if (savingsRate < 0.1) {
    insights.push({ text: 'Low savings rate', type: 'warning' });
  }

  if (totalExpenses > totalIncome) {
    insights.push({ text: 'Spending exceeds income', type: 'danger' });
  }

  insights.forEach(insight => {
    const p = document.createElement('p');
    p.className = `text-sm font-medium insight-badge badge-${insight.type}`;
    p.textContent = insight.text;
    insightsContainer.appendChild(p);
  });
}

function updateSmartInsights(periodData, categoryData, transactions) {
  const container = document.getElementById('smartInsightsContainer');
  container.innerHTML = '';

  const insights = generateInsights(periodData, categoryData, transactions);

  insights.forEach(insight => {
    const div = document.createElement('div');
    div.className = 'bg-white rounded-lg p-4 border-l-4';
    div.style.borderColor = insight.color;
    div.innerHTML = `
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style="background: ${insight.color}20">
          <span style="color: ${insight.color}">${insight.icon}</span>
        </div>
        <div class="flex-1">
          <h4 class="font-semibold text-gray-900 text-sm mb-1">${insight.title}</h4>
          <p class="text-sm text-gray-600">${insight.description}</p>
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}

function generateInsights(periodData, categoryData, transactions) {
  const insights = [];
  const periods = Object.keys(periodData);

  const totalIncome = periods.reduce((sum, p) => sum + periodData[p].income, 0);
  const totalExpenses = periods.reduce((sum, p) => sum + periodData[p].expenses, 0);
  const totalSavings = periods.reduce((sum, p) => sum + periodData[p].savings, 0);

  const categories = Object.entries(categoryData).sort((a, b) => b[1].amount - a[1].amount);
  if (categories.length > 0) {
    const topCategory = categories[0];
    const percentage = (topCategory[1].amount / totalExpenses * 100).toFixed(1);
    insights.push({
      title: 'Top Spending Category',
      description: `${topCategory[0]} accounts for ${percentage}% of your expenses (${topCategory[1].amount.toFixed(0)} XAF)`,
      icon: '📊',
      color: '#2B9FD9'
    });
  }

  const savingsRate = totalIncome > 0 ? (totalSavings / totalIncome * 100) : 0;
  if (savingsRate >= 20) {
    insights.push({
      title: 'Excellent Savings',
      description: `You're saving ${savingsRate.toFixed(1)}% of your income. Keep it up!`,
      icon: '✓',
      color: '#10b981'
    });
  } else if (savingsRate < 10 && totalIncome > 0) {
    insights.push({
      title: 'Increase Savings',
      description: `Try to save at least 10-20% of your income. Currently at ${savingsRate.toFixed(1)}%`,
      icon: '⚠',
      color: '#f59e0b'
    });
  }

  if (totalExpenses > totalIncome) {
    const deficit = totalExpenses - totalIncome;
    insights.push({
      title: 'Budget Alert',
      description: `You're spending ${deficit.toFixed(0)} XAF more than you earn. Review your expenses.`,
      icon: '⚠',
      color: '#ef4444'
    });
  } else {
    const surplus = totalIncome - totalExpenses;
    insights.push({
      title: 'Positive Balance',
      description: `You have a surplus of ${surplus.toFixed(0)} XAF this period.`,
      icon: '✓',
      color: '#10b981'
    });
  }

  const avgTransactionsPerPeriod = periods.reduce((sum, p) => sum + periodData[p].transactions, 0) / periods.length;
  if (avgTransactionsPerPeriod > 20) {
    insights.push({
      title: 'High Transaction Volume',
      description: `You average ${avgTransactionsPerPeriod.toFixed(0)} transactions per period. Consider consolidating purchases.`,
      icon: 'ℹ',
      color: '#3b82f6'
    });
  }

  return insights;
}

function updateSpendingPatterns(transactions) {
  const container = document.getElementById('spendingPatternsContainer');
  container.innerHTML = '';

  const expenseTransactions = transactions.filter(t => t.type === 'expense');

  if (expenseTransactions.length === 0) {
    container.innerHTML = '<p class="text-gray-500">No expense data to analyze patterns</p>';
    return;
  }

  const dayPatterns = {};
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  expenseTransactions.forEach(trans => {
    const day = new Date(trans.date).getDay();
    const dayName = weekdays[day];
    dayPatterns[dayName] = (dayPatterns[dayName] || 0) + parseFloat(trans.amount);
  });

  const maxDaySpending = Math.max(...Object.values(dayPatterns));
  const topSpendingDay = Object.entries(dayPatterns).find(([_, amount]) => amount === maxDaySpending);

  const earlyMonth = expenseTransactions.filter(t => new Date(t.date).getDate() <= 10).length;
  const midMonth = expenseTransactions.filter(t => {
    const day = new Date(t.date).getDate();
    return day > 10 && day <= 20;
  }).length;
  const lateMonth = expenseTransactions.filter(t => new Date(t.date).getDate() > 20).length;

  container.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
        <h4 class="font-semibold text-gray-900 mb-2">Peak Spending Day</h4>
        <p class="text-2xl font-bold text-blue-600">${topSpendingDay ? topSpendingDay[0] : 'N/A'}</p>
        <p class="text-sm text-gray-600 mt-1">${topSpendingDay ? topSpendingDay[1].toFixed(0) + ' XAF' : ''}</p>
      </div>
      
      <div class="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
        <h4 class="font-semibold text-gray-900 mb-2">Monthly Pattern</h4>
        <div class="space-y-1 mt-2">
          <div class="flex justify-between text-sm">
            <span class="text-gray-600">Early (1-10)</span>
            <span class="font-semibold">${earlyMonth} txns</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-gray-600">Mid (11-20)</span>
            <span class="font-semibold">${midMonth} txns</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-gray-600">Late (21-31)</span>
            <span class="font-semibold">${lateMonth} txns</span>
          </div>
        </div>
      </div>
      
      <div class="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
        <h4 class="font-semibold text-gray-900 mb-2">Transaction Stats</h4>
        <p class="text-sm text-gray-600">Total Expenses</p>
        <p class="text-2xl font-bold text-green-600">${expenseTransactions.length}</p>
        <p class="text-sm text-gray-600 mt-2">
          Avg: ${(expenseTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0) / expenseTransactions.length).toFixed(0)} XAF
        </p>
      </div>
    </div>
  `;
}

function calculateVariance(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length);
}

function destroyAllCharts() {
  Object.values(charts).forEach(chart => {
    if (chart) chart.destroy();
  });
  charts = {};
}
import { getTransactions, getLoans, initDatabase, getCurrentUser, logout, getAIRecommendation, saveAIRecommendation } from './database.js';
import { setLanguage, getTranslation } from './i18n.js';
import { getFinancialAdvice } from './ai-logic.js';
import { runGlobalAnalysis } from './analysis-logic.js';
import { getGeminiAdvice } from './ai-service.js';

var spendingChart, categoryChart, monthlyComparisonChart;
var allTransactions = [];
var allLoans = [];
var currentFilter = {
  period: 'all',
  type: 'all',
  startDate: null,
  endDate: null
};

function formatCurrency(amount) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XAF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount).replace('XAF', '').trim();
}

document.addEventListener('DOMContentLoaded', function () {
  initDatabase().then(function () {
    var currentUser = getCurrentUser();
    if (!currentUser) {
      window.location.href = '/index.html';
      return;
    }

    document.getElementById('userName').textContent = currentUser;
    document.getElementById('logoutBtn').addEventListener('click', function () {
      logout();
      window.location.href = '/index.html';
    });

    document.getElementById('getAdviceBtn').addEventListener('click', function () {
      var currentUser = getCurrentUser();
      getTransactions(currentUser).then(function (transactions) {
        var totalIncome = 0;
        var totalExpenses = 0;

        transactions.forEach(function (t) {
          var amount = parseFloat(t.amount) || 0;
          if (t.type === 'income') totalIncome += amount;
          else if (t.type === 'expense') totalExpenses += amount;
        });

        if (typeof getFinancialAdvice === 'function') {
          var displayElement = document.getElementById('ai-advice-display');
          var language = window.localStorage.getItem('language') || 'en';
          var loadingText = language === 'fr' ? 'Analyse en cours...' : 'Thinking...';

          if (displayElement) displayElement.innerHTML = '<div class="flex items-center gap-2"><div class="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div> ' + loadingText + '</div>';

          getFinancialAdvice({
            totalIncome: totalIncome,
            totalExpenses: totalExpenses
          }).then(function (advice) {
            if (displayElement) {
              displayElement.innerHTML = advice.replace(/\n/g, '<br>');
            }
          }).catch(function (err) {
            if (displayElement) displayElement.textContent = "Error getting advice.";
          });
        }
      });
    });

    document.querySelectorAll('.period-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.period-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        currentFilter.period = btn.dataset.period;
        currentFilter.startDate = null;
        currentFilter.endDate = null;
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';
        applyFilters();
      });
    });

    document.getElementById('applyCustomPeriod').addEventListener('click', function () {
      var startDate = document.getElementById('startDate').value;
      var endDate = document.getElementById('endDate').value;

      if (startDate && endDate) {
        currentFilter.period = 'custom';
        currentFilter.startDate = new Date(startDate);
        currentFilter.endDate = new Date(endDate);
        document.querySelectorAll('.period-btn').forEach(function (b) { b.classList.remove('active'); });
        applyFilters();
      }
    });

    document.getElementById('transactionTypeFilter').addEventListener('change', function (e) {
      currentFilter.type = e.target.value;
      applyFilters();
    });

    loadDashboard();
  });
});

function loadDashboard() {
  var currentUser = getCurrentUser();
  getTransactions(currentUser).then(function (transactions) {
    allTransactions = transactions;
    return getLoans(currentUser);
  }).then(function (loans) {
    allLoans = loans;
    applyFilters();

    if (typeof runGlobalAnalysis === 'function') {
      runGlobalAnalysis();
    }
  });
}

function filterTransactions(transactions) {
  var filtered = transactions.slice();

  if (currentFilter.type !== 'all') {
    filtered = filtered.filter(function (t) { return t.type === currentFilter.type; });
  }

  var now = new Date();

  switch (currentFilter.period) {
    case 'daily':
      var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filtered = filtered.filter(function (t) {
        var transDate = new Date(t.date);
        return transDate >= today;
      });
      break;

    case 'weekly':
      var weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(function (t) { return new Date(t.date) >= weekAgo; });
      break;

    case 'monthly':
      var monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      filtered = filtered.filter(function (t) { return new Date(t.date) >= monthStart; });
      break;

    case 'yearly':
      var yearStart = new Date(now.getFullYear(), 0, 1);
      filtered = filtered.filter(function (t) { return new Date(t.date) >= yearStart; });
      break;

    case 'custom':
      if (currentFilter.startDate && currentFilter.endDate) {
        filtered = filtered.filter(function (t) {
          var transDate = new Date(t.date);
          return transDate >= currentFilter.startDate && transDate <= currentFilter.endDate;
        });
      }
      break;

    case 'all':
    default:
      break;
  }

  return filtered;
}

function applyFilters() {
  var filteredTransactions = filterTransactions(allTransactions);
  updateDashboardWithData(filteredTransactions, allLoans);
}

function updateDashboardWithData(transactions, loans) {
  var totalIncome = 0;
  var totalExpenses = 0;
  var totalSavings = 0;
  var categorySpending = {};
  var monthlyData = {};

  transactions.forEach(function (trans) {
    var amount = parseFloat(trans.amount);
    var date = new Date(trans.date).toLocaleString('default', { month: 'short' });

    if (trans.type === 'income') totalIncome += amount;
    else if (trans.type === 'expense') totalExpenses += amount;
    else if (trans.type === 'savings') totalSavings += amount;

    if (trans.type === 'expense') {
      categorySpending[trans.category] = (categorySpending[trans.category] || 0) + amount;
    }

    if (!monthlyData[date]) monthlyData[date] = { income: 0, expenses: 0 };
    if (trans.type === 'income') monthlyData[date].income += amount;
    else if (trans.type === 'expense') monthlyData[date].expenses += amount;
  });

  var totalLoanDebt = loans.reduce(function (sum, loan) {
    return sum + parseFloat(loan.amount);
  }, 0);

  var totalBalance = totalIncome - totalExpenses; // Simplified to match bank account style: Income - Expenses. Savings and Loans are separate categories or treated as transactions.

  getTransactions(getCurrentUser()).then(allTransactions => {
    let absoluteIncome = 0;
    let absoluteExpenses = 0;
    allTransactions.forEach(t => {
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'income') absoluteIncome += amt;
      else if (t.type === 'expense') absoluteExpenses += amt;
    });
    const absoluteBalance = absoluteIncome - absoluteExpenses;
    document.getElementById('headerBalance').textContent = formatCurrency(absoluteBalance);
    document.getElementById('sidebarBalance').textContent = formatCurrency(absoluteBalance);
  });
  document.getElementById('totalIncome').textContent = formatCurrency(totalIncome);
  document.getElementById('totalExpenses').textContent = formatCurrency(totalExpenses);
  document.getElementById('totalSavings').textContent = formatCurrency(totalSavings);

  updateFinancialHealth(totalIncome, totalExpenses, totalSavings, totalLoanDebt);

  displayRecentTransactions(transactions);

  if (Object.keys(monthlyData).length > 0) {
    initSpendingChart(monthlyData);
    initCategoryChart(categorySpending);
    initMonthlyComparisonChart(monthlyData);
  } else {
    clearCharts();
  }

  checkForAlerts(transactions, totalBalance, totalLoanDebt);
}

function updateFinancialHealth(income, expenses, savings, loanDebt) {
  var savingRate = income > 0 ? ((savings / income) * 100) : 0;
  var expenseRatio = income > 0 ? ((expenses / income) * 100) : 0;

  document.getElementById('savingRate').textContent = savingRate.toFixed(1) + '%';
  document.getElementById('savingRateBar').style.width = Math.min(savingRate, 100) + '%';

  document.getElementById('expenseRatio').textContent = expenseRatio.toFixed(1) + '%';
  document.getElementById('expenseRatioBar').style.width = Math.min(expenseRatio, 100) + '%';
}

function displayRecentTransactions(transactions) {
  var container = document.getElementById('recentTransactions');
  var recentTrans = transactions
    .slice()
    .sort(function (a, b) { return new Date(b.date) - new Date(a.date); })
    .slice(0, 5);

  if (recentTrans.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-sm text-center py-8">No transactions yet</p>';
    return;
  }

  container.innerHTML = recentTrans.map(function (trans) {
    var amount = parseFloat(trans.amount);
    var isIncome = trans.type === 'income';
    var isSavings = trans.type === 'savings';
    var colorClass = isIncome ? 'text-green-600' : isSavings ? 'text-purple-600' : 'text-red-600';
    var bgClass = isIncome ? 'bg-green-50' : isSavings ? 'bg-purple-50' : 'bg-red-50';
    var sign = isIncome ? '+' : '-';

    return [
      '<div class="recent-transaction-item flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-all">',
      '  <div class="flex items-center gap-3 flex-1">',
      '    <div class="w-10 h-10 rounded-lg ' + bgClass + ' flex items-center justify-center">',
      '      <svg class="w-5 h-5 ' + colorClass + '" fill="none" stroke="currentColor" viewBox="0 0 24 24">',
      isIncome ? '        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>' :
        isSavings ? '        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"></path>' :
          '        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"></path>',
      '      </svg>',
      '    </div>',
      '    <div class="flex-1 min-w-0">',
      '      <p class="text-sm font-semibold text-gray-900 truncate">' + (trans.description || trans.category) + '</p>',
      '      <p class="text-xs text-gray-500">' + new Date(trans.date).toLocaleDateString() + '</p>',
      '    </div>',
      '  </div>',
      '  <div class="text-right">',
      '    <p class="text-sm font-bold ' + colorClass + '">' + sign + formatCurrency(amount) + '</p>',
      '    <p class="text-xs text-gray-500 capitalize">' + trans.category + '</p>',
      '  </div>',
      '</div>'
    ].join('\n');
  }).join('');
}

function initSpendingChart(monthlyData) {
  var ctx = document.getElementById('spendingChart').getContext('2d');

  if (spendingChart) spendingChart.destroy();

  var months = Object.keys(monthlyData);
  var incomeData = months.map(function (m) { return monthlyData[m].income; });
  var expenseData = months.map(function (m) { return monthlyData[m].expenses; });

  spendingChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: months,
      datasets: [
        {
          label: 'Income',
          data: incomeData,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
          fill: true,
          borderWidth: 3,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#10b981',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
        },
        {
          label: 'Expenses',
          data: expenseData,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          tension: 0.4,
          fill: true,
          borderWidth: 3,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#ef4444',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 15,
            font: {
              size: 12,
              weight: '600'
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleFont: {
            size: 14,
            weight: '600'
          },
          bodyFont: {
            size: 13
          },
          callbacks: {
            label: function (context) {
              return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          },
          ticks: {
            callback: function (value) {
              return formatCurrency(value);
            }
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      }
    }
  });
}

function initCategoryChart(categorySpending) {
  var ctx = document.getElementById('categoryChart').getContext('2d');

  if (categoryChart) categoryChart.destroy();

  var categories = Object.keys(categorySpending);
  if (categories.length === 0) {
    var container = ctx.canvas.parentElement;
    container.innerHTML = '<div class="h-80 flex items-center justify-center"><p class="text-gray-500 text-sm">No expense data available</p></div>';
    return;
  }

  var amounts = Object.values(categorySpending);
  var colors = ['#2B9FD9', '#2F5F87', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

  categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: categories,
      datasets: [{
        data: amounts,
        backgroundColor: colors.slice(0, categories.length),
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 15,
            usePointStyle: true,
            font: {
              size: 11,
              weight: '600'
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          callbacks: {
            label: function (context) {
              var total = context.dataset.data.reduce(function (a, b) { return a + b; }, 0);
              var percentage = ((context.parsed / total) * 100).toFixed(1);
              return context.label + ': ' + formatCurrency(context.parsed) + ' (' + percentage + '%)';
            }
          }
        }
      }
    }
  });
}

function clearCharts() {
  if (spendingChart) {
    spendingChart.destroy();
    spendingChart = null;
  }
  if (categoryChart) {
    categoryChart.destroy();
    categoryChart = null;
  }
  if (monthlyComparisonChart) {
    monthlyComparisonChart.destroy();
    monthlyComparisonChart = null;
  }

  document.getElementById('spendingChart').parentElement.innerHTML = '<div class="h-80 flex items-center justify-center"><p class="text-gray-500 text-sm">No data available for selected period</p></div><canvas id="spendingChart" style="display:none;"></canvas>';
  document.getElementById('categoryChart').parentElement.innerHTML = '<div class="h-80 flex items-center justify-center"><p class="text-gray-500 text-sm">No data available for selected period</p></div><canvas id="categoryChart" style="display:none;"></canvas>';
  document.getElementById('monthlyComparisonChart').parentElement.innerHTML = '<div class="h-48 flex items-center justify-center"><p class="text-gray-500 text-sm">No data available</p></div><canvas id="monthlyComparisonChart" style="display:none;"></canvas>';
}

function initMonthlyComparisonChart(monthlyData) {
  var ctx = document.getElementById('monthlyComparisonChart').getContext('2d');

  if (monthlyComparisonChart) monthlyComparisonChart.destroy();

  var months = Object.keys(monthlyData);
  var netSavings = months.map(function (m) { return monthlyData[m].income - monthlyData[m].expenses; });

  monthlyComparisonChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [{
        label: 'Net Savings',
        data: netSavings,
        backgroundColor: netSavings.map(function (val) { return val >= 0 ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)'; }),
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          callbacks: {
            label: function (context) {
              return 'Net: ' + formatCurrency(context.parsed.y);
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          },
          ticks: {
            callback: function (value) {
              return formatCurrency(value);
            }
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      }
    }
  });
}

function checkForAlerts(transactions, balance, loanDebt) {
  var alertsContainer = document.getElementById('alertsContainer');
  alertsContainer.innerHTML = '';

  var expenses = transactions.filter(function (t) { return t.type === 'expense'; });
  var expenseSum = expenses.reduce(function (sum, t) { return sum + parseFloat(t.amount); }, 0);
  var income = transactions.filter(function (t) { return t.type === 'income'; });
  var incomeSum = income.reduce(function (sum, t) { return sum + parseFloat(t.amount); }, 0);

  if (expenseSum > incomeSum * 0.8 && incomeSum > 0) {
    var alert = document.createElement('div');
    alert.className = 'bg-red-50 border-l-4 border-red-500 rounded-lg p-4';
    alert.innerHTML = [
      '<div class="flex items-center gap-3">',
      '  <div class="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">',
      '    <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">',
      '      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>',
      '    </svg>',
      '  </div>',
      '  <div class="flex-1">',
      '    <h3 class="font-bold text-red-900">High Spending Alert</h3>',
      '    <p class="text-red-700 text-sm">Your expenses are ' + ((expenseSum / incomeSum) * 100).toFixed(1) + '% of your income.</p>',
      '  </div>',
      '</div>'
    ].join('\n');
    alertsContainer.appendChild(alert);
  }

  if (balance < 0) {
    var alert = document.createElement('div');
    alert.className = 'bg-red-50 border-l-4 border-red-600 rounded-lg p-4';
    alert.innerHTML = [
      '<div class="flex items-center gap-3">',
      '  <div class="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">',
      '    <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">',
      '      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path>',
      '    </svg>',
      '  </div>',
      '  <div class="flex-1">',
      '    <h3 class="font-bold text-red-900">Deficit Alert</h3>',
      '    <p class="text-red-700 text-sm">Your account balance is negative: ' + formatCurrency(Math.abs(balance)) + '</p>',
      '  </div>',
      '</div>'
    ].join('\n');
    alertsContainer.appendChild(alert);
  }

  if (loanDebt > 0) {
    var debtRatio = incomeSum > 0 ? (loanDebt / incomeSum) * 100 : 0;
    var alertLevel = debtRatio > 50 ? 'red' : debtRatio > 30 ? 'yellow' : 'blue';
    var borderColor = alertLevel === 'red' ? 'border-red-500' : alertLevel === 'yellow' ? 'border-yellow-500' : 'border-blue-500';
    var bgColor = alertLevel === 'red' ? 'bg-red-50' : alertLevel === 'yellow' ? 'bg-yellow-50' : 'bg-blue-50';
    var iconBg = alertLevel === 'red' ? 'bg-red-100' : alertLevel === 'yellow' ? 'bg-yellow-100' : 'bg-blue-100';
    var iconColor = alertLevel === 'red' ? 'text-red-600' : alertLevel === 'yellow' ? 'text-yellow-600' : 'text-blue-600';
    var textColor = alertLevel === 'red' ? 'text-red-900' : alertLevel === 'yellow' ? 'text-yellow-900' : 'text-blue-900';
    var subtextColor = alertLevel === 'red' ? 'text-red-700' : alertLevel === 'yellow' ? 'text-yellow-700' : 'text-blue-700';

    var alert = document.createElement('div');
    alert.className = bgColor + ' border-l-4 ' + borderColor + ' rounded-lg p-4';
    alert.innerHTML = [
      '<div class="flex items-center gap-3">',
      '  <div class="w-10 h-10 rounded-lg ' + iconBg + ' flex items-center justify-center">',
      '    <svg class="w-6 h-6 ' + iconColor + '" fill="none" stroke="currentColor" viewBox="0 0 24 24">',
      '      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>',
      '    </svg>',
      '  </div>',
      '  <div class="flex-1">',
      '    <h3 class="font-bold ' + textColor + '">Outstanding Loans</h3>',
      '    <p class="' + subtextColor + ' text-sm">You have ' + formatCurrency(loanDebt) + ' in loan debt' + (incomeSum > 0 ? ' (' + debtRatio.toFixed(1) + '% of income)' : '') + '.</p>',
      '  </div>',
      '</div>'
    ].join('\n');
    alertsContainer.appendChild(alert);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

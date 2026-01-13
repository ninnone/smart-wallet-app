import { addLoan, getLoans, deleteLoan, getTransactions, initDatabase, getCurrentUser, logout, addSavingsGoal, getSavingsGoals, deleteSavingsGoal, updateLoan } from './database.js';
import { predictLoanImpact, getDebtToIncomeAdvice } from './ai-logic.js';
import { checkLoanDeadlines } from './analysis-logic.js';

document.addEventListener('DOMContentLoaded', function () {
  initDatabase().then(function () {
    var currentUser = getCurrentUser();
    if (!currentUser) {
      window.location.href = '../../index.html';
      return;
    }

    document.getElementById('userName').textContent = currentUser;

    document.getElementById('logoutBtn').addEventListener('click', function () {
      logout();
      window.location.href = '../../index.html';
    });

    document.getElementById('loanForm').addEventListener('submit', handleAddLoan);
    document.getElementById('goalForm').addEventListener('submit', handleAddGoal);

    var simulateBtn = document.getElementById('simulateBtn');
    if (simulateBtn) {
      simulateBtn.addEventListener('click', handleSimulate);
    }

    loadLoans();
    loadGoals();
    updateSummaryCards();
    updateCategoryMetrics();

    // Task 3: Loan & Deadline Monitoring (AI Advice)
    checkLoanDeadlines();
  });
});

function handleAddGoal(e) {
  e.preventDefault();
  var currentUser = getCurrentUser();
  var name = document.getElementById('goalName').value;
  var target = parseFloat(document.getElementById('goalTarget').value);

  if (!name || isNaN(target) || target <= 0) {
    showNotification('Please enter a valid goal name and target amount', 'warning');
    return;
  }

  var goal = {
    username: currentUser,
    name: name,
    target: target,
    createdAt: new Date()
  };

  addSavingsGoal(goal).then(function () {
    e.target.reset();
    loadGoals();
    showNotification('Savings goal created!', 'success');
  });
}

function loadGoals() {
  var currentUser = getCurrentUser();
  getSavingsGoals(currentUser).then(function (goals) {
    getTransactions(currentUser).then(function (transactions) {
      // Calculate total savings
      var totalSavings = transactions
        .filter(function (t) { return t.type === 'savings'; })
        .reduce(function (sum, t) { return sum + (parseFloat(t.amount) || 0); }, 0);

      var list = document.getElementById('goalsList');
      if (!list) return;
      list.innerHTML = '';

      if (goals.length === 0) {
        list.innerHTML = '<p class="text-sm text-gray-500 italic">No goals set yet. Start by creating one!</p>';
        return;
      }

      goals.forEach(function (goal) {
        var progress = Math.min(100, (totalSavings / goal.target) * 100);
        var div = document.createElement('div');
        div.className = 'goal-item';
        div.innerHTML = [
          '<div class="flex justify-between items-center mb-2">',
          '  <div>',
          '    <h4 class="font-bold text-gray-900">' + goal.name + '</h4>',
          '    <p class="text-xs text-gray-500">' + totalSavings.toFixed(0) + ' / ' + goal.target.toFixed(0) + ' XAF</p>',
          '  </div>',
          '  <div class="text-right">',
          '    <span class="text-sm font-bold text-green-600">' + progress.toFixed(1) + '%</span>',
          '    <button onclick="confirmDeleteGoal(' + goal.id + ')" class="ml-4 text-red-500 hover:text-red-700 text-xs font-bold">Delete</button>',
          '  </div>',
          '</div>',
          '<div class="w-full bg-gray-200 rounded-full h-2.5">',
          '  <div class="bg-green-600 h-2.5 rounded-full" style="width: ' + progress + '%"></div>',
          '</div>'
        ].join('\n');
        list.appendChild(div);
      });
    });
  });
}

window.confirmDeleteGoal = function (id) {
  if (confirm('Delete this goal?')) {
    deleteSavingsGoal(id).then(function () {
      loadGoals();
      showNotification('Goal deleted', 'info');
    });
  }
};

function handleAddLoan(e) {
  e.preventDefault();

  var currentUser = getCurrentUser();
  var loanAmountInput = document.getElementById('loanAmountInput'); // Changed ID
  var loanAmount = parseFloat(loanAmountInput.value);

  if (isNaN(loanAmount) || loanAmount <= 0) {
    showNotification(' Please enter a valid loan amount', 'warning');
    return;
  }

  getTransactions(currentUser).then(function (transactions) {
    var monthlyExpenses = transactions
      .filter(function (t) { return t.type === 'expense'; })
      .reduce(function (sum, t) { return sum + parseFloat(t.amount); }, 0) / Math.max(1, new Set(transactions.map(function (t) { return new Date(t.date).toLocaleString('default', { month: 'long', year: 'numeric' }); })).size);

    var impactAnalysis = analyzeImpact(loanAmount, monthlyExpenses);

    if (impactAnalysis.riskLevel === 'high') {
      var confirmVal = window.confirm(' WARNING: Adding this loan will impact your savings:\n\n' + impactAnalysis.message + '\n\nDo you want to continue?');
      if (!confirmVal) return;
    }

    var loan = {
      username: currentUser,
      type: document.getElementById('loanType').value,
      person: document.getElementById('loanPerson').value || 'Unknown',
      amount: loanAmount,
      dueDate: document.getElementById('dueDate').value,
      description: document.getElementById('loanDescription').value || 'No description',
      impactAnalysis: impactAnalysis,
      createdAt: new Date()
    };

    var loanId = document.getElementById('loanId').value;
    var promise;

    if (loanId) {
      loan.id = parseInt(loanId);
      promise = updateLoan(loan);
    } else {
      promise = addLoan(loan);
    }

    return promise.then(function () {
      e.target.reset();
      document.getElementById('loanId').value = '';
      document.querySelector('#loanForm .submit-btn span').textContent = 'Add Loan';
      loadLoans();
      updateSummaryCards();
      updateCategoryMetrics();
      checkLoanDeadlines();
      showNotification(' Loan added successfully! ' + impactAnalysis.message, impactAnalysis.riskLevel === 'high' ? 'warning' : 'success');
    });
  });
}

function analyzeImpact(loanAmount, monthlyExpenses) {
  var monthlyPayment = loanAmount / 12;
  var expenseIncrease = monthlyExpenses > 0 ? (monthlyPayment / monthlyExpenses) * 100 : 0;

  var riskLevel = 'low';
  var message = 'Monthly impact: ' + monthlyPayment.toFixed(0) + ' XAF (+' + expenseIncrease.toFixed(1) + '% increase in expenses)';

  if (expenseIncrease > 50) {
    riskLevel = 'high';
    message = ' CRITICAL: This loan will increase your monthly expenses by ' + expenseIncrease.toFixed(1) + '%. This is unsustainable.';
  } else if (expenseIncrease > 30) {
    riskLevel = 'medium';
    message = ' Monthly impact: ' + monthlyPayment.toFixed(0) + ' XAF (+' + expenseIncrease.toFixed(1) + '% increase). Be careful with your budget.';
  }

  return { riskLevel: riskLevel, message: message, monthlyPayment: monthlyPayment, expenseIncrease: expenseIncrease };
}

function updateSummaryCards() {
  var currentUser = getCurrentUser();
  getLoans(currentUser).then(function (loans) {
    var totalAmount = loans.reduce(function (sum, loan) { return sum + parseFloat(loan.amount); }, 0);
    var now = new Date();
    var upcomingLoans = loans.filter(function (loan) {
      var dueDate = new Date(loan.dueDate);
      var daysLeft = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
      return daysLeft > 0 && daysLeft <= 7;
    });
    var overdueLoans = loans.filter(function (loan) { return new Date(loan.dueDate) < now; });

    document.getElementById('totalLoansAmount').textContent = totalAmount.toFixed(0) + ' XAF';
    document.getElementById('totalLoansCount').textContent = loans.length;
    document.getElementById('upcomingCount').textContent = upcomingLoans.length;
    document.getElementById('overdueCount').textContent = overdueLoans.length;
    document.getElementById('loanCount').innerHTML = loans.length + ' <span data-i18n="loans.items">items</span>';

    // Update headers with ABSOLUTE total balance
    getTransactions(currentUser).then(function (allTransactions) {
      var absIncome = 0;
      var absExpenses = 0;
      allTransactions.forEach(function (t) {
        var amt = parseFloat(t.amount) || 0;
        if (t.type === 'income') absIncome += amt;
        else if (t.type === 'expense') absExpenses += amt;
      });
      var absBalance = absIncome - absExpenses;
      var hb = document.getElementById('headerBalance');
      var sb = document.getElementById('sidebarBalance');
      if (hb) hb.textContent = absBalance.toFixed(0) + ' XAF';
      if (sb) sb.textContent = absBalance.toFixed(0) + ' XAF';
    });
  });
}

function updateCategoryMetrics() {
  var currentUser = getCurrentUser();
  getLoans(currentUser).then(function (loans) {
    // Filter loans by type
    var loanItems = loans.filter(function (loan) { return loan.type === 'loan'; });
    var debtItems = loans.filter(function (loan) { return loan.type === 'debt'; });
    var borrowingItems = loans.filter(function (loan) { return loan.type === 'borrowing'; });

    // Calculate amounts
    var loanAmount = loanItems.reduce(function (sum, loan) { return sum + parseFloat(loan.amount); }, 0);
    var debtAmount = debtItems.reduce(function (sum, loan) { return sum + parseFloat(loan.amount); }, 0);
    var borrowingAmount = borrowingItems.reduce(function (sum, loan) { return sum + parseFloat(loan.amount); }, 0);

    // Update Loans Given metrics - using new IDs
    document.getElementById('loansGivenAmount').textContent = loanAmount.toFixed(0) + ' XAF';
    document.getElementById('loansGivenCount').textContent = loanItems.length;

    // Update Debts Owed metrics - using new IDs
    document.getElementById('debtsOwedAmount').textContent = debtAmount.toFixed(0) + ' XAF';
    document.getElementById('debtsOwedCount').textContent = debtItems.length;

    // Update Borrowings metrics - using new IDs
    document.getElementById('borrowingsAmount').textContent = borrowingAmount.toFixed(0) + ' XAF';
    document.getElementById('borrowingsCount').textContent = borrowingItems.length;
  });
}

function loadLoans() {
  var currentUser = getCurrentUser();
  getLoans(currentUser).then(function (loans) {
    var list = document.getElementById('loansList');
    list.innerHTML = '';

    if (loans.length === 0) {
      list.innerHTML = [
        '<div class="p-12 text-center">',
        '  <svg class="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">',
        '    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>',
        '  </svg>',
        '  <p class="text-gray-500 font-medium" data-i18n="loans.noLoans">No loans yet</p>',
        '  <p class="text-sm text-gray-400 mt-1" data-i18n="loans.addFirst">Add your first loan to start tracking</p>',
        '</div>'
      ].join('\n');
      return;
    }

    loans.sort(function (a, b) { return new Date(a.dueDate) - new Date(b.dueDate); });

    loans.forEach(function (loan) {
      var dueDate = new Date(loan.dueDate);
      var now = new Date();
      var isOverdue = dueDate < now;
      var daysLeft = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

      var statusClass, statusText, statusIcon;
      if (isOverdue) {
        statusClass = 'bg-red-100 text-red-700 border-red-200';
        statusText = 'OVERDUE';
        statusIcon = '<span class="status-dot bg-red-500"></span>';
      } else if (daysLeft <= 7) {
        statusClass = 'bg-amber-100 text-amber-700 border-amber-200';
        statusText = daysLeft + ' days left';
        statusIcon = '<span class="status-dot bg-amber-500"></span>';
      } else {
        statusClass = 'bg-green-100 text-green-700 border-green-200';
        statusText = daysLeft + ' days';
        statusIcon = '<span class="status-dot bg-green-500"></span>';
      }

      var impactClass = loan.impactAnalysis ? (loan.impactAnalysis.riskLevel === 'high' ? 'impact-high' :
        loan.impactAnalysis.riskLevel === 'medium' ? 'impact-medium' : 'impact-low') : '';

      // Determine type badge
      var typeBadgeClass, typeBadgeText;
      switch (loan.type) {
        case 'loan':
          typeBadgeClass = 'bg-blue-100 text-blue-700 border-blue-200';
          typeBadgeText = 'LOAN GIVEN';
          break;
        case 'debt':
          typeBadgeClass = 'bg-red-100 text-red-700 border-red-200';
          typeBadgeText = 'DEBT OWED';
          break;
        case 'borrowing':
          typeBadgeClass = 'bg-purple-100 text-purple-700 border-purple-200';
          typeBadgeText = 'BORROWING';
          break;
        default:
          typeBadgeClass = 'bg-gray-100 text-gray-700 border-gray-200';
          typeBadgeText = loan.type.toUpperCase();
      }

      var row = document.createElement('div');
      row.className = 'loan-card p-6 hover:bg-gray-50 transition';
      row.innerHTML = [
        '<div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">',
        '  <div class="flex-1">',
        '    <div class="flex items-start justify-between mb-2">',
        '      <div>',
        '        <div class="flex items-center gap-2 mb-1">',
        '          <h3 class="font-semibold text-gray-900 text-lg">' + (loan.description || loan.type) + '</h3>',
        '          <p class="text-sm font-bold text-primary italic">with ' + (loan.person || 'Unknown') + '</p>',
        '        </div>',
        '        <div class="flex items-center gap-2 mt-1">',
        '          <span class="type-badge ' + typeBadgeClass + ' text-xs px-2 py-1 rounded-full">',
        '            ' + typeBadgeText,
        '          </span>',
        '          <p class="text-sm text-gray-500">',
        '            <span class="inline-flex items-center gap-1">',
        '              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">',
        '                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>',
        '              </svg>',
        '              Due: ' + dueDate.toLocaleDateString(),
        '            </span>',
        '          </p>',
        '        </div>',
        '      </div>',
        '      <span class="status-badge ' + statusClass + '">',
        '        ' + statusIcon,
        '        ' + statusText,
        '      </span>',
        '    </div>',
        loan.impactAnalysis ? [
          '    <div class="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg ' + impactClass + ' text-xs">',
          '      <span>' + loan.impactAnalysis.message + '</span>',
          '    </div>'
        ].join('\n') : '',
        '  </div>',
        '  <div class="flex items-center gap-4">',
        '    <div class="text-right">',
        '      <p class="text-xs text-gray-500 font-medium uppercase mb-1">Amount</p>',
        '      <p class="text-2xl font-bold text-gray-900">' + parseFloat(loan.amount).toFixed(0) + '</p>',
        '      <p class="text-xs text-gray-500">XAF</p>',
        '    </div>',
        '    <div class="flex items-center gap-2">',
        '      <button onclick="window.editLoan(' + loan.id + ')" class="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition font-medium text-sm flex items-center gap-2 border border-indigo-200">',
        '        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">',
        '          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>',
        '        </svg>',
        '        Edit',
        '      </button>',
        '      <button onclick="confirmDeleteLoan(' + loan.id + ')" class="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition font-medium text-sm flex items-center gap-2 border border-red-200">',
        '        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">',
        '          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>',
        '        </svg>',
        '        Delete',
        '      </button>',
        '    </div>',
        '  </div>',
        '</div>'
      ].join('\n');
      list.appendChild(row);
    });
  });
}

window.confirmDeleteLoan = function (id) {
  if (confirm('Are you sure you want to delete this loan? This action cannot be undone.')) {
    deleteLoan(id).then(function () {
      loadLoans();
      updateSummaryCards();
      updateCategoryMetrics();
      checkLoanDeadlines();
      showNotification(' Loan deleted successfully', 'success');
    });
  }
};

window.editLoan = function (id) {
  var currentUser = getCurrentUser();
  getLoans(currentUser).then(function (loans) {
    var loan = loans.find(l => l.id === id);
    if (loan) {
      document.getElementById('loanId').value = loan.id;
      document.getElementById('loanType').value = loan.type;
      document.getElementById('loanPerson').value = loan.person;
      document.getElementById('loanAmountInput').value = loan.amount;
      document.getElementById('dueDate').value = loan.dueDate;
      document.getElementById('loanDescription').value = loan.description;

      document.querySelector('#loanForm .submit-btn span').textContent = 'Update Loan';

      window.scrollTo({ top: document.querySelector('#loanForm').offsetTop - 100, behavior: 'smooth' });
    }
  });
};

function handleSimulate() {
  var amountInput = document.getElementById('simLoanAmount');
  var resultDiv = document.getElementById('simulation-result');
  var amount = parseFloat(amountInput.value);

  if (isNaN(amount) || amount <= 0) {
    showNotification('Please enter a valid amount to simulate', 'warning');
    return;
  }

  resultDiv.textContent = 'AI is analyzing loan impact...';
  resultDiv.classList.add('animate-pulse');

  predictLoanImpact(amount).then(function (prediction) {
    resultDiv.classList.remove('animate-pulse');
    resultDiv.innerHTML = '<strong>AI Prediction:</strong> ' + prediction;
  }).catch(function (error) {
    console.error('Simulation Error:', error);
    resultDiv.classList.remove('animate-pulse');
    resultDiv.textContent = 'Error during simulation. Please try again.';
  });
}

function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `fixed top-20 right-8 px-6 py-4 rounded-lg shadow-lg z-50 transform transition-all duration-300 ${type === 'success' ? 'bg-green-500' :
    type === 'warning' ? 'bg-amber-500' : 'bg-red-500'
    } text-white font-medium`;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}
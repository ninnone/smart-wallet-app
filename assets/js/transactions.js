import { initDatabase, getTransactions, getCurrentUser, logout, addTransaction, deleteTransaction, updateTransaction } from './database.js';
import { getSavingsPercentageSuggestion, refineOCRWithAI } from './ai-logic.js';
import { getTranslation, getCurrentLanguage } from './i18n.js';

var isLoadingRecommendation = false;
var isProcessingOCR = false;
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  await initDatabase();

  const currentUser = getCurrentUser();
  if (!currentUser) {
    window.location.href = '../../index.html';
    return;
  }

  document.getElementById('userName').textContent = currentUser;

  // Logout handler
  var logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      logout();
      window.location.href = '../../index.html';
    });
  }

  document.getElementById('transactionDate').valueAsDate = new Date();
  document.getElementById('transactionType').addEventListener('change', handleTypeChange);
  document.getElementById('trans-amount').addEventListener('input', debounce(handleAmountChange, 500));
  document.getElementById('transactionForm').addEventListener('submit', handleAddTransaction);

  // Filter Tabs Event Listeners
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.dataset.filter;
      loadTransactions(currentFilter);
    });
  });

  var fileUploadZone = document.getElementById('fileUploadZone');
  var receiptUpload = document.getElementById('receipt-upload');

  if (fileUploadZone && receiptUpload) {
    fileUploadZone.addEventListener('click', function () {
      window.location.href = './ocr.html';
    });
    fileUploadZone.addEventListener('dragover', function (e) {
      e.preventDefault();
      fileUploadZone.classList.add('border-indigo-500', 'bg-indigo-50/80');
    });
    fileUploadZone.addEventListener('dragleave', function () {
      fileUploadZone.classList.remove('border-indigo-500', 'bg-indigo-50/80');
    });
    fileUploadZone.addEventListener('drop', function (e) {
      e.preventDefault();
      fileUploadZone.classList.remove('border-indigo-500', 'bg-indigo-50/80');
      if (e.dataTransfer.files.length > 0) {
        handleOCR(e.dataTransfer.files[0]);
      }
    });
    receiptUpload.addEventListener('change', function (e) {
      if (e.target.files.length > 0) {
        handleOCR(e.target.files[0]);
      }
    });
  }

  loadTransactions();
});

// Debounce function for input
function debounce(func, wait) {
  var timeout;
  return function () {
    var args = arguments;
    var later = function () {
      clearTimeout(timeout);
      func.apply(null, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function handleTypeChange() {
  var type = document.getElementById('transactionType').value;
  var amount = parseFloat(document.getElementById('trans-amount').value);
  if (type === 'savings' && amount > 0) {
    fetchSavingsRecommendation(amount);
  } else {
    clearRecommendation();
  }
}

function handleAmountChange() {
  var type = document.getElementById('transactionType').value;
  var amount = parseFloat(document.getElementById('trans-amount').value);
  if (type === 'savings' && amount > 0) {
    fetchSavingsRecommendation(amount);
  } else if (type === 'savings') {
    clearRecommendation();
  }
}

function fetchSavingsRecommendation(amount) {
  if (isLoadingRecommendation) return;
  var container = document.getElementById('aiRecommendationContainer');
  var currentUser = getCurrentUser();
  var language = getCurrentLanguage();

  container.innerHTML = [
    '<div class="ai-recommendation bg-indigo-50 border-l-4 border-indigo-500 p-6 rounded-2xl animate-fade-in mt-4">',
    '  <div class="flex items-center gap-3">',
    '    <div class="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>',
    '    <p class="font-bold text-indigo-900">',
    '      ' + (language === 'fr' ? 'Analyse de votre objectif d\'épargne...' : 'Analyzing your savings goal...'),
    '    </p>',
    '  </div>',
    '</div>'
  ].join('\n');

  isLoadingRecommendation = true;

  getTransactions(currentUser).then(function (transactions) {
    var totalIncome = transactions
      .filter(function (t) { return t.type === 'income'; })
      .reduce(function (sum, t) { return sum + parseFloat(t.amount); }, 0);
    var totalExpenses = transactions
      .filter(function (t) { return t.type === 'expense'; })
      .reduce(function (sum, t) { return sum + parseFloat(t.amount); }, 0);
    return getSavingsPercentageSuggestion(totalIncome, totalExpenses + amount);
  }).then(function (advice) {
    displayRecommendation(advice, amount, language);
  }).catch(function (error) {
    console.error('Error fetching AI recommendation:', error);
    clearRecommendation();
  }).finally(function () {
    isLoadingRecommendation = false;
  });
}

function displayRecommendation(advice, amount, language) {
  var container = document.getElementById('aiRecommendationContainer');
  var icon = '<svg class="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>';

  container.innerHTML = [
    '<div class="ai-recommendation bg-gradient-to-br from-indigo-50 to-white border-2 border-indigo-100 p-8 rounded-[2rem] animate-scale-in mt-6 shadow-xl shadow-indigo-500/5">',
    '  <div class="flex gap-4">',
    '    <div class="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center flex-shrink-0">',
    '      ' + icon,
    '    </div>',
    '    <div class="flex-1">',
    '      <div class="flex items-center justify-between mb-3">',
    '        <h4 class="font-black text-slate-800 text-lg uppercase tracking-tight">',
    '          ' + (language === 'fr' ? 'Flash Conseil IA' : 'AI Power Insight'),
    '        </h4>',
    '        <span class="bg-indigo-100 text-indigo-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">' + (language === 'fr' ? 'Propulsé par Gemini' : 'Powered by Gemini') + '</span>',
    '      </div>',
    '      <div class="text-slate-600 font-medium leading-relaxed italic">"' + advice + '"</div>',
    '    </div>',
    '  </div>',
    '</div>'
  ].join('\n');
}

function clearRecommendation() {
  const container = document.getElementById('aiRecommendationContainer');
  if (container) container.innerHTML = '';
}

async function handleOCR(file) {
  if (isProcessingOCR) return;
  var language = getCurrentLanguage();

  if (!file.type.startsWith('image/')) {
    showNotification(language === 'fr' ? 'Format non supporté' : 'Unsupported format (Images only)', 'error');
    return;
  }

  showNotification(language === 'fr' ? '⚡ Analyse du reçu en cours...' : '⚡ Analyzing receipt...', 'info');
  isProcessingOCR = true;

  try {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageData = e.target.result;

      // Tesseract OCR
      const result = await Tesseract.recognize(imageData, 'eng');
      const ocrText = result.data.text;
      console.log("OCR Extracted:", ocrText);

      // Refine with AI
      const aiResult = await refineOCRWithAI(ocrText);
      console.log("AI Parsed:", aiResult);

      // Apply to form
      var amountMatch = aiResult.match(/Amount:\s*([\d,.]+)/i);
      var merchantMatch = aiResult.match(/Merchant:\s*([^,]+)/i);
      var dateMatchAi = aiResult.match(/Date:\s*([\d\/-]+)/i);
      var categoryMatch = aiResult.match(/Category:\s*(\w+)/i);

      if (amountMatch) {
        var amt = parseFloat(amountMatch[1].replace(',', '.'));
        if (!isNaN(amt)) document.getElementById('trans-amount').value = amt;
      }
      if (merchantMatch) {
        document.getElementById('description').value = merchantMatch[1].trim();
      }
      if (categoryMatch) {
        const cat = categoryMatch[1].toLowerCase();
        const select = document.getElementById('trans-category');
        if (Array.from(select.options).some(o => o.value === cat)) {
          select.value = cat;
        }
      }
      if (dateMatchAi) {
        var dParts = dateMatchAi[1].split(/[\/\-]/);
        if (dParts.length === 3) {
          var y = dParts[2].length === 2 ? "20" + dParts[2] : dParts[2];
          var m = dParts[1].padStart(2, '0');
          var d = dParts[0].padStart(2, '0');
          document.getElementById('transactionDate').value = `${y}-${m}-${d}`;
        }
      }

      showNotification(language === 'fr' ? '✅ Reçu scanné avec succès!' : '✅ Receipt scanned successfully!', 'success');
      isProcessingOCR = false;
    };
    reader.readAsDataURL(file);
  } catch (err) {
    console.error("OCR Pipeline Error:", err);
    showNotification(language === 'fr' ? '❌ Échec de la lecture' : '❌ Scan failed', 'error');
    isProcessingOCR = false;
  }
}

function handleAddTransaction(e) {
  e.preventDefault();
  var currentUser = getCurrentUser();
  var transaction = {
    username: currentUser,
    type: document.getElementById('transactionType').value,
    category: document.getElementById('trans-category').value,
    amount: document.getElementById('trans-amount').value,
    date: document.getElementById('transactionDate').value,
    description: document.getElementById('description').value || 'No description',
    createdAt: new Date()
  };

  var transactionId = document.getElementById('transactionId').value;
  var promise;

  if (transactionId) {
    transaction.id = parseInt(transactionId);
    promise = updateTransaction(transaction);
  } else {
    promise = addTransaction(transaction);
  }

  promise.then(function () {
    document.getElementById('transactionForm').reset();
    document.getElementById('transactionId').value = '';
    document.querySelector('#transactionForm button[type="submit"] span').textContent = getCurrentLanguage() === 'fr' ? 'Enregistrer la transaction' : 'Save Transaction';
    document.getElementById('transactionDate').valueAsDate = new Date();
    clearRecommendation();
    loadTransactions(currentFilter);
    showNotification(
      getCurrentLanguage() === 'fr' ? 'Transaction ajoutée!' : 'Transaction saved!',
      'success'
    );
  });
}

function loadTransactions(filterType = 'all') {
  var currentUser = getCurrentUser();
  getTransactions(currentUser).then(function (transactions) {
    let totalIncome = 0;
    let totalExpenses = 0;
    transactions.forEach(t => {
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'income') totalIncome += amt;
      else if (t.type === 'expense') totalExpenses += amt;
    });
    const absoluteBalance = totalIncome - totalExpenses;
    document.getElementById('headerBalance').textContent = absoluteBalance.toFixed(0) + ' XAF';
    document.getElementById('sidebarBalance').textContent = absoluteBalance.toFixed(0) + ' XAF';

    var list = document.getElementById('transactionsList');
    if (!list) return; // For safety if running on other pages
    list.innerHTML = '';

    let filteredTransactions = transactions;
    if (filterType !== 'all') {
      filteredTransactions = transactions.filter(t => t.type === filterType);
    }

    if (filteredTransactions.length === 0) {
      list.innerHTML = '<div class="p-12 text-center text-slate-400 font-bold uppercase tracking-widest">' + (getCurrentLanguage() === 'fr' ? 'Aucune transaction' : 'No transactions found') + '</div>';
      return;
    }

    filteredTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    filteredTransactions.forEach(function (trans) {
      var row = document.createElement('div');
      row.className = 'transaction-card group flex justify-between items-center p-8 bg-white hover:bg-slate-50 border-b border-slate-100 transition-all duration-300';

      var amountColor = trans.type === 'income' ? 'text-emerald-600' : trans.type === 'savings' ? 'text-indigo-600' : 'text-rose-600';
      var amountPrefix = trans.type === 'income' ? '+' : trans.type === 'savings' ? '' : '-';

      row.innerHTML = `
                <div class="flex items-center gap-6">
                    <div class="w-16 h-16 rounded-3xl flex items-center justify-center transition-all duration-500 group-hover:rotate-6 bg-slate-100">
                        ${getTransactionIcon(trans.type)}
                    </div>
                    <div>
                        <div class="flex items-center gap-3 mb-1">
                            <p class="text-lg font-black text-slate-800">${trans.category.toUpperCase()}</p>
                            <span class="text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter ${amountColor.replace('text', 'bg').replace('600', '100')} ${amountColor}">${trans.type}</span>
                        </div>
                        <p class="text-slate-500 font-bold text-sm">${trans.description}</p>
                        <p class="text-[10px] text-slate-400 font-black uppercase mt-1 tracking-widest">${new Date(trans.date).toLocaleDateString()}</p>
                    </div>
                </div>
                <div class="flex items-center gap-8 text-right">
                    <div>
                        <p class="text-2xl font-black ${amountColor}">${amountPrefix}${parseFloat(trans.amount).toFixed(0)} XAF</p>
                    </div>
                    <div class="flex items-center gap-2">
                      <button class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-indigo-100 hover:text-indigo-600 transition-all duration-300 opacity-0 group-hover:opacity-100" onclick="window.editTransaction(${trans.id})">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                      </button>
                      <button class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-rose-100 hover:text-rose-600 transition-all duration-300 opacity-0 group-hover:opacity-100" onclick="window.deleteTransaction(${trans.id})">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                          </svg>
                      </button>
                    </div>
                </div>
            `;
      list.appendChild(row);
    });
  });
}

function getTransactionIcon(type) {
  const icons = {
    income: '<svg class="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>',
    expense: '<svg class="w-8 h-8 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"></path></svg>',
    savings: '<svg class="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
  };
  return icons[type] || icons.expense;
}

window.deleteTransaction = function (id) {
  var language = getCurrentLanguage();
  var confirmMessage = language === 'fr' ? 'Supprimer cette transaction ?' : 'Delete this transaction?';
  if (confirm(confirmMessage)) {
    deleteTransaction(id).then(function () {
      loadTransactions(currentFilter);
      showNotification(language === 'fr' ? 'Supprimée' : 'Deleted', 'success');
    });
  }
};

window.editTransaction = function (id) {
  var currentUser = getCurrentUser();
  getTransactions(currentUser).then(function (transactions) {
    var trans = transactions.find(t => t.id === id);
    if (trans) {
      document.getElementById('transactionId').value = trans.id;
      document.getElementById('transactionType').value = trans.type;
      document.getElementById('trans-category').value = trans.category;
      document.getElementById('trans-amount').value = trans.amount;
      document.getElementById('transactionDate').value = trans.date;
      document.getElementById('description').value = trans.description;

      document.querySelector('#transactionForm button[type="submit"] span').textContent = getCurrentLanguage() === 'fr' ? 'Mettre à jour' : 'Update Transaction';

      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
};

function showNotification(message, type = 'info') {
  const existing = document.getElementById('notification');
  if (existing) existing.remove();
  const colors = { success: 'bg-emerald-500', error: 'bg-rose-500', info: 'bg-indigo-600' };
  const notification = document.createElement('div');
  notification.id = 'notification';
  notification.className = `fixed top-8 right-8 ${colors[type]} text-white px-8 py-4 rounded-3xl shadow-2xl z-50 animate-scale-in font-black tracking-tight text-sm flex items-center gap-3`;

  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : '⚡';
  notification.innerHTML = `<span>${icon}</span> <span>${message}</span>`;

  document.body.appendChild(notification);
  setTimeout(() => {
    notification.classList.add('opacity-0', 'translate-y-4');
    setTimeout(() => notification.remove(), 500);
  }, 4000);
}

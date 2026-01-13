import { addTransaction, initDatabase, getCurrentUser, logout, saveExtractedDocument, getTransactions } from './database.js';
import { refineOCRWithAI } from './ai-logic.js';
// import { enhanceExtraction } from './ai-extraction-service.js';
import { getTranslation } from './i18n.js';

var extractedAmounts = [];
var extractedData = {};
var selectedFile = null;
var ocrText = '';

document.addEventListener('DOMContentLoaded', function () {
  initDatabase().then(function () {
    var currentUser = getCurrentUser();
    if (!currentUser) {
      window.location.href = '/index.html';
      return;
    }

    // Logout handler
    var logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        logout();
        window.location.href = '/index.html';
      });
    }

    initializeOCRHandlers();

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
      if (document.getElementById('headerBalance')) document.getElementById('headerBalance').textContent = absBalance.toFixed(0) + ' XAF';
      if (document.getElementById('sidebarBalance')) document.getElementById('sidebarBalance').textContent = absBalance.toFixed(0) + ' XAF';
    });
  });
});

function initializeOCRHandlers() {
  var dropZone = document.getElementById('dropZone');
  var fileInput = document.getElementById('fileInput');
  var imagePreview = document.getElementById('imagePreview');
  var previewImage = document.getElementById('previewImage');
  var scanButton = document.getElementById('scanButton');
  var processingStatus = document.getElementById('processingStatus');
  var results = document.getElementById('results');
  var saveButton = document.getElementById('saveButton');
  var resetButton = document.getElementById('resetButton');
  var cameraBtn = document.getElementById('cameraBtn');

  // Camera button handler
  if (cameraBtn) {
    cameraBtn.addEventListener('click', function () {
      window.location.href = 'camera.html';
    });
  }

  // Check for captured image from camera or pending upload from transactions
  var capturedImage = localStorage.getItem('cameraCapture') || localStorage.getItem('pendingOCR');
  if (capturedImage) {
    localStorage.removeItem('cameraCapture');
    localStorage.removeItem('pendingOCR');
    // Convert base64 to File object
    fetch(capturedImage)
      .then(function (res) { return res.blob(); })
      .then(function (blob) {
        var file = new File([blob], 'captured_receipt.jpg', { type: 'image/jpeg' });
        handleFile(file);
        // Automatically start scanning if it's a direct camera return
        setTimeout(function () {
          performOCR();
        }, 500);
      });
  }

  // Drag and drop handlers
  dropZone.addEventListener('click', function () { fileInput.click(); });

  dropZone.addEventListener('dragover', function (e) {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', function () {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', function (e) {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    var file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFile(file);
    } else if (file && file.type === 'application/pdf') {
      alert(getTranslation('ocr.uploadImage'));
    }
  });

  fileInput.addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (file) {
      if (file.type === 'application/pdf') {
        alert(getTranslation('ocr.uploadImage'));
        fileInput.value = '';
        return;
      }
      handleFile(file);
    }
  });

  scanButton.addEventListener('click', performOCR);
  saveButton.addEventListener('click', addExtractedTransaction);
  resetButton.addEventListener('click', resetForm);
}

function handleFile(file) {
  selectedFile = file;
  var reader = new FileReader();
  reader.onload = function (e) {
    var previewImage = document.getElementById('previewImage');
    previewImage.src = e.target.result;
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSize').textContent = (file.size / 1024).toFixed(2) + ' KB';
    document.getElementById('imagePreview').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function performOCR() {
  if (!selectedFile) return;

  var processingStatus = document.getElementById('processingStatus');
  var results = document.getElementById('results');

  processingStatus.classList.remove('hidden');
  results.classList.add('hidden');

  try {
    var reader = new FileReader();
    reader.onload = function (e) {
      var imageData = e.target.result;

      // Perform OCR
      Tesseract.recognize(imageData, 'eng', {
        logger: function (m) { console.log('OCR Progress:', m); }
      }).then(function (result) {
        ocrText = result.data.text;
        document.getElementById('ocrText').textContent = ocrText;

        // Extract data
        return extractData(ocrText);
      }).then(function () {
        processingStatus.classList.add('hidden');
        results.classList.remove('hidden');
      });
    };
    reader.readAsDataURL(selectedFile);
  } catch (error) {
    console.error('OCR Error:', error);
    alert(getTranslation('ocr.errorProcessing'));
    processingStatus.classList.add('hidden');
  }
}

function extractData(text) {
  var lines = text.split('\n').filter(function (l) { return l.trim(); });
  var merchantInput = document.getElementById('merchant');
  merchantInput.value = lines[0] || '';

  var amountRegex = /\d+[.,]\d{2,}/g;
  var amounts = text.match(amountRegex) || [];
  extractedAmounts = amounts.map(function (a) { return parseFloat(a.replace(/[,]/g, '.')); });

  extractedAmounts = extractedAmounts.filter(function (item, pos, self) {
    return self.indexOf(item) == pos;
  }).sort(function (a, b) { return b - a; });

  var amountOptions = document.getElementById('amountOptions');
  amountOptions.innerHTML = '';

  if (extractedAmounts.length === 0) {
    amountOptions.innerHTML = '<p class="text-gray-500 text-sm">' + (getTranslation('ocr.noAmountFound') || 'No amounts found. Please enter manually.') + '</p>';
  } else {
    extractedAmounts.forEach(function (amount, i) {
      var div = document.createElement('div');
      div.className = 'amount-option transition-all';
      div.innerHTML = [
        '<input type="radio" name="amount" value="' + amount + '" id="amount' + i + '" class="mr-2" ' + (i === 0 ? 'checked' : '') + '>',
        '<label for="amount' + i + '" class="cursor-pointer flex-1 px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50">' + amount.toFixed(0) + ' XAF</label>'
      ].join('\n');
      amountOptions.appendChild(div);

      div.querySelector('label').addEventListener('click', function () {
        div.querySelector('input').checked = true;
      });
    });
  }

  var dateRegex = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/;
  var dateMatch = text.match(dateRegex);
  var dateInput = document.getElementById('date');

  if (dateMatch) {
    var dateParts = dateMatch[1].split(/[\/\-]/);
    var d = dateParts[0];
    var m = dateParts[1];
    var y = dateParts[2];

    if (y.length === 2) y = '20' + y;
    m = m.padStart(2, '0');
    d = d.padStart(2, '0');
    dateInput.value = y + '-' + m + '-' + d;
  } else {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  suggestCategory(text);

  return refineOCRWithAI(text).then(function (aiResult) {
    if (aiResult) {
      console.log("AI OCR Refined Result:", aiResult);
      if (aiResult.amount) document.getElementById('customAmount').value = aiResult.amount;
      if (aiResult.merchant) document.getElementById('merchant').value = aiResult.merchant;
      if (aiResult.category) document.getElementById('category').value = aiResult.category;
      if (aiResult.date) {
        var dr = aiResult.date;
        if (dr.includes('/')) {
          var parts = dr.split('/');
          if (parts[0].length === 4) { // yyyy/mm/dd
            document.getElementById('date').value = parts[0] + "-" + parts[1].padStart(2, '0') + "-" + parts[2].padStart(2, '0');
          } else { // dd/mm/yyyy
            document.getElementById('date').value = parts[2] + "-" + parts[1].padStart(2, '0') + "-" + parts[0].padStart(2, '0');
          }
        } else {
          document.getElementById('date').value = dr;
        }
      }
    }
  });
}

function suggestCategory(text) {
  var textLower = text.toLowerCase();
  var categorySelect = document.getElementById('category');

  var categoryKeywords = {
    'Food & Dining': ['restaurant', 'cafe', 'coffee', 'bar', 'pizza', 'burger', 'dining', 'food', 'kitchen', 'bistro', 'grill', 'bakery'],
    'Groceries': ['grocery', 'market', 'supermarket', 'walmart', 'costco', 'safeway', 'shoprite', 'carrefour', 'santa lucia', 'dovv'],
    'Transportation': ['gas', 'fuel', 'uber', 'lyft', 'taxi', 'parking', 'metro', 'transit', 'shell', 'total', 'tradex', 'oil'],
    'Shopping': ['store', 'shop', 'mall', 'retail', 'amazon', 'target', 'clothing', 'fashion', 'shoes'],
    'Entertainment': ['cinema', 'movie', 'theater', 'game', 'concert', 'ticket', 'netflix', 'spotify', 'leisure'],
    'Bills & Utilities': ['electric', 'water', 'internet', 'phone', 'bill', 'utility', 'insurance', 'eneo', 'camwater', 'mtn', 'orange'],
    'Healthcare': ['pharmacy', 'doctor', 'hospital', 'medical', 'clinic', 'health', 'medicine', 'dental']
  };

  var categories = Object.keys(categoryKeywords);
  for (var i = 0; i < categories.length; i++) {
    var category = categories[i];
    var keywords = categoryKeywords[category];
    if (keywords.some(function (keyword) { return textLower.includes(keyword); })) {
      categorySelect.value = category;
      return;
    }
  }

  categorySelect.value = 'Other';
}

function addExtractedTransaction() {
  var merchant = document.getElementById('merchant').value.trim();
  var date = document.getElementById('date').value;
  var selectedAmount = document.querySelector('input[name="amount"]:checked');
  var customAmount = document.getElementById('customAmount').value;
  var amount = customAmount || (selectedAmount ? selectedAmount.value : '');
  var category = document.getElementById('category').value;
  var notes = document.getElementById('notes').value.trim();

  if (!merchant || !date || !amount || !category) {
    alert(getTranslation('ocr.fillRequired') || 'Please fill all required fields');
    return;
  }

  var currentUser = getCurrentUser();

  var categoryMap = {
    'Food & Dining': 'food',
    'Groceries': 'food',
    'Shopping': 'other',
    'Transportation': 'transport',
    'Entertainment': 'entertainment',
    'Bills & Utilities': 'other',
    'Healthcare': 'health',
    'Other': 'other'
  };

  var transaction = {
    username: currentUser,
    type: 'expense',
    category: categoryMap[category] || 'other',
    amount: parseFloat(amount),
    date: date,
    description: notes || (merchant + ' - ' + category),
    merchant: merchant,
    createdAt: new Date()
  };

  addTransaction(transaction).then(function () {
    var docData = {
      merchant: merchant,
      amount: parseFloat(amount),
      category: category,
      date: date,
      ocrText: ocrText,
      transactionId: Date.now()
    };
    return saveExtractedDocument(currentUser, docData);
  }).then(function () {
    alert(getTranslation('ocr.saveSuccess') || 'Transaction saved successfully!');
    resetForm();
  }).catch(function (error) {
    console.error('Error saving transaction:', error);
    alert(getTranslation('auth.genericError') || 'An error occurred. Please try again.');
  });
}

function resetForm() {
  selectedFile = null;
  ocrText = '';
  extractedData = {};
  extractedAmounts = [];

  document.getElementById('imagePreview').classList.add('hidden');
  document.getElementById('results').classList.add('hidden');
  document.getElementById('fileInput').value = '';
  document.getElementById('merchant').value = '';
  document.getElementById('date').value = '';
  document.getElementById('customAmount').value = '';
  document.getElementById('category').value = '';
  document.getElementById('notes').value = '';
  document.getElementById('ocrText').textContent = getTranslation('ocr.ocrPlaceholder') || 'Raw OCR text will appear here...';
  document.getElementById('amountOptions').innerHTML = '';
}

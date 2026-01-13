var DB_NAME = 'SmartWalletDB';
var DB_VERSION = 7;

var db;

function initDatabase() {
  if (db) return Promise.resolve(db);

  return new Promise(function (resolve, reject) {
    try {
      if (!window.indexedDB) {
        console.error("Your browser doesn't support a stable version of IndexedDB.");
        reject(new Error("IndexedDB not supported"));
        return;
      }

      var request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = function (event) {
        console.error('Database error:', event.target.error);
        reject(event.target.error);
      };

      request.onsuccess = function (event) {
        db = event.target.result;
        console.log("Database connected successfully:", DB_NAME);

        db.onversionchange = function () {
          db.close();
          alert("A new version of this page is ready. Please reload!");
          location.reload();
        };

        resolve(db);
      };

      request.onblocked = function () {
        console.warn("Database connection blocked by another tab.");
        alert("Please close other tabs of this app and reload.");
      };

      request.onupgradeneeded = function (event) {
        var database = event.target.result;
        console.log("Upgrading database to version:", DB_VERSION);

        if (!database.objectStoreNames.contains('userProfile')) {
          var profileStore = database.createObjectStore('userProfile', { keyPath: 'username' });
          profileStore.createIndex('username', 'username', { unique: true });
        }

        if (!database.objectStoreNames.contains('transactions')) {
          var transStore = database.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
          transStore.createIndex('username', 'username', { unique: false });
          transStore.createIndex('date', 'date', { unique: false });
        }

        if (!database.objectStoreNames.contains('loans')) {
          var loanStore = database.createObjectStore('loans', { keyPath: 'id', autoIncrement: true });
          loanStore.createIndex('username', 'username', { unique: false });
          loanStore.createIndex('dueDate', 'dueDate', { unique: false });
        }

        if (!database.objectStoreNames.contains('savings')) {
          var savingStore = database.createObjectStore('savings', { keyPath: 'id', autoIncrement: true });
          savingStore.createIndex('username', 'username', { unique: false });
        }

        if (!database.objectStoreNames.contains('users')) {
          var userStore = database.createObjectStore('users', { keyPath: 'username' });
          userStore.createIndex('username', 'username', { unique: true });
        }

        if (!database.objectStoreNames.contains('savingsGoals')) {
          var goalStore = database.createObjectStore('savingsGoals', { keyPath: 'id', autoIncrement: true });
          goalStore.createIndex('username', 'username', { unique: false });
        }

        if (!database.objectStoreNames.contains('aiRecommendations')) {
          var recStore = database.createObjectStore('aiRecommendations', { keyPath: 'id', autoIncrement: true });
          recStore.createIndex('username', 'username', { unique: false });
          recStore.createIndex('period', 'period', { unique: false });
        }

        if (!database.objectStoreNames.contains('extractedDocuments')) {
          var docStore = database.createObjectStore('extractedDocuments', { keyPath: 'id', autoIncrement: true });
          docStore.createIndex('username', 'username', { unique: false });
          docStore.createIndex('date', 'date', { unique: false });
        }
      };
    } catch (e) {
      console.error("Critical error opening database:", e);
      reject(e);
    }
  });
}

function dbOperation(storeName, method, data) {
  return new Promise(function (resolve, reject) {
    if (!db) {
      initDatabase().then(function () {
        performOp();
      }).catch(reject);
    } else {
      performOp();
    }

    function performOp() {
      var transaction = db.transaction(storeName, 'readwrite');
      var store = transaction.objectStore(storeName);
      var request = store[method](data);

      request.onerror = function () { reject(request.error); };
      request.onsuccess = function () { resolve(request.result); };
    }
  });
}

function addRecord(storeName, record) {
  return dbOperation(storeName, 'add', record);
}

function getRecords(storeName, username) {
  return new Promise(function (resolve, reject) {
    if (!db) {
      initDatabase().then(function () {
        fetchRecords();
      }).catch(reject);
    } else {
      fetchRecords();
    }

    function fetchRecords() {
      var store = db.transaction(storeName, 'readonly').objectStore(storeName);
      var index = store.index('username');
      var request = index.getAll(username);
      request.onerror = function () { reject(request.error); };
      request.onsuccess = function () { resolve(request.result); };
    }
  });
}

function deleteRecord(storeName, id) {
  return dbOperation(storeName, 'delete', id);
}

function addUser(user) { return dbOperation('users', 'add', user); }
function updateUser(user) { return dbOperation('users', 'put', user); }
function getUser(username) { return dbOperation('users', 'get', username); }
function addTransaction(transaction) { return addRecord('transactions', transaction); }
function getTransactions(username) { return getRecords('transactions', username); }
function deleteTransaction(id) { return deleteRecord('transactions', id); }
function updateTransaction(transaction) { return dbOperation('transactions', 'put', transaction); }
function addLoan(loan) { return addRecord('loans', loan); }
function getLoans(username) { return getRecords('loans', username); }
function deleteLoan(id) { return deleteRecord('loans', id); }
function updateLoan(loan) { return dbOperation('loans', 'put', loan); }
function addSavingsGoal(goal) { return addRecord('savingsGoals', goal); }
function getSavingsGoals(username) { return getRecords('savingsGoals', username); }
function deleteSavingsGoal(id) { return deleteRecord('savingsGoals', id); }
function upsertUserProfile(profile) { return dbOperation('userProfile', 'put', profile); }
function getUserProfile(username) { return dbOperation('userProfile', 'get', username); }

function deleteUserAccount(username) {
  var stores = ['users', 'transactions', 'loans', 'savings', 'savingsGoals', 'aiRecommendations', 'extractedDocuments', 'userProfile'];
  return Promise.all(stores.map(function (storeName) {
    return new Promise(function (resolve, reject) {
      var transaction = db.transaction(storeName, 'readwrite');
      var store = transaction.objectStore(storeName);

      if (storeName === 'users' || storeName === 'userProfile') {
        var request = store.delete(username);
        request.onsuccess = function () { resolve(); };
        request.onerror = function () { reject(request.error); };
      } else {
        var index = store.index('username');
        var request = index.openKeyCursor(IDBKeyRange.only(username));
        request.onsuccess = function (event) {
          var cursor = event.target.result;
          if (cursor) {
            store.delete(cursor.primaryKey);
            cursor.continue();
          } else {
            resolve();
          }
        };
        request.onerror = function () { reject(request.error); };
      }
    });
  }));
}

function saveAIRecommendation(username, period, advice, metrics) {
  var recommendation = {
    username: username,
    period: period,
    advice: advice,
    metrics: metrics,
    timestamp: new Date(),
    expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  };
  return addRecord('aiRecommendations', recommendation);
}

function getAIRecommendation(username, period) {
  return new Promise(function (resolve, reject) {
    getRecords('aiRecommendations', username).then(function (results) {
      var cached = results.find(function (r) { return r.period === period && new Date(r.expireAt) > new Date(); });
      resolve(cached || null);
    }).catch(reject);
  });
}

function saveExtractedDocument(username, documentData) {
  var doc = Object.assign({}, documentData, {
    username: username,
    date: new Date()
  });
  return addRecord('extractedDocuments', doc);
}

function getExtractedDocuments(username) {
  return getRecords('extractedDocuments', username);
}

function getCurrentUser() {
  return localStorage.getItem('currentUser');
}

function setCurrentUser(username) {
  localStorage.setItem('currentUser', username);
}

function logout() {
  localStorage.removeItem('currentUser');
}

export {
  initDatabase,
  addUser,
  updateUser,
  getUser,
  addTransaction,
  getTransactions,
  deleteTransaction,
  updateTransaction,
  addLoan,
  getLoans,
  deleteLoan,
  updateLoan,
  addSavingsGoal,
  getSavingsGoals,
  deleteSavingsGoal,
  upsertUserProfile,
  getUserProfile,
  deleteUserAccount,
  saveAIRecommendation,
  getAIRecommendation,
  saveExtractedDocument,
  getExtractedDocuments,
  getCurrentUser,
  setCurrentUser,
  logout,
  addRecord,
  getRecords,
  deleteRecord
};

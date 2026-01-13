# Smart Wallet – Web-Based Personal Finance Management System

## 📌 Project Overview

**Smart Wallet** is a web-based application designed to help users intelligently manage their personal finances.  
The platform allows users to track **income, expenses, savings, loans, and borrowings**, while offering **smart analysis, statistics, and AI-driven advice**.

This project was developed as part of the course **ISI3195 – Web Technologies and Programming 1**  
at **Institut Saint Jean – Cycle Engineer (Computer Science & Information Systems)**.

---

## 🎯 Objectives

- Enable users to manage their wallet efficiently
- Analyze spending habits and detect risky behaviors
- Provide visual dashboards and financial statistics
- Extract amounts from receipts, invoices, and payment proofs
- Store user data locally using **IndexedDB**
- Provide AI-based financial advice

---

## 🧱 Technologies Used (Strictly Compliant with Project Constraints)

| Category | Technology |
|--------|------------|
| Languages | HTML, CSS, JavaScript |
| UI Framework | TailwindCSS |
| Charts & Visualization | Chart.js |
| OCR (Document Scanning) | Tesseract.js |
| Local Database | IndexedDB |
| AI Advisory Service | Gemini API |
| Deployment | GitHub Pages / GitLab Pages |

⚠️ **No backend, no external frameworks, and no forbidden libraries were used.**

---

## ✨ Main Features

### 1️⃣ User Management
- User registration (username, password, profile info)
- User profile viewing
- User-specific data isolation using IndexedDB

---

### 2️⃣ Transaction Management
- Manual entry of:
  - Income (salary, transfers, business)
  - Expenses (food, transport, health, leisure, etc.)
- Automatic extraction of amounts from:
  - Receipts
  - Invoices
  - Payment confirmations (Mobile Money, bank slips)
- Savings tracking (goals & available amount)
- Loan & borrowing management with deadlines

---

### 3️⃣ Smart Analysis & Dashboard
- Spending analysis per category
- Monthly deficit risk detection
- Savings suggestions based on income
- Statistical visualization:
  - Daily / Weekly / Monthly / Annual
  - Custom date ranges
- Graphs for spending vs savings trends (Chart.js)
- Current balance overview

---

### 4️⃣ AI Financial Advice
- Uses **Gemini API**
- Analyzes:
  - Income trends
  - Expense patterns
  - Savings rate
- Generates personalized financial advice

---

## 🗂️ Project Structure

```text
smart-wallet-app/
│
├── index.html                     # Application entry point (landing / login)
├── package.json                   # Project dependencies & scripts
├── package-lock.json              # Dependency lock file
├── postcss.config.js              # PostCSS configuration (Tailwind)
├── tailwind.config.js              # TailwindCSS configuration
├── vite.config.js                 # Vite configuration
│
├── assets/
│   ├── css/
│   │   ├── main.css                # Tailwind base file
│   │   ├── dashboard.css           # Dashboard-specific styles
│   │   ├── loans.css               # Loans page styles
│   │   ├── ocr.css                 # OCR page styles
│   │   ├── profile.css             # Profile page styles
│   │   └── transaction.css         # Transactions page styles
│   │
│   ├── images/
│   │   └── logo.png                # Application logo
│   │
│   └── js/
│       ├── auth.js                 # User authentication logic
│       ├── database.js             # IndexedDB initialization & schema
│       ├── dashboard.js            # Dashboard logic & stats
│       ├── transactions.js         # Income & expense management
│       ├── loans.js                # Loan & borrowing management
│       ├── profile.js              # User profile logic
│       ├── analysis.js             # Financial analysis logic
│       ├── analysis-logic.js        # Advanced analytics helpers
│       ├── camera.js               # Camera access for OCR
│       ├── ocr.js                  # Tesseract.js OCR processing
│       ├── ai-service.js            # DeepSeek API communication
│       ├── ai-logic.js              # AI advice processing
│       ├── ai-extraction-service.js # AI-based data extraction
│       ├── header.js               # Shared header/navigation logic
│       └── i18n.js                 # Language & localization logic
│
├── src/
│   └── pages/
│       ├── index.html              # Login / entry page
│       ├── dashboard.html          # User dashboard
│       ├── transactions.html       # Transactions management
│       ├── loans.html              # Loans & borrowings
│       ├── profile.html            # User profile
│       ├── ocr.html                # OCR receipt scanning
│       ├── camera.html             # Camera capture page
│       └── analysis.html           # Financial analysis page
│
├── node_modules/                   # Installed dependencies (ignored in git)
│
└── README.md                       # Project documentation

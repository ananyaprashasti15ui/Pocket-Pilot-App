# PocketPilot - Smart Finance Manager for Students

PocketPilot is a full-stack student finance dashboard that parses transaction messages, auto-categorizes them, splits money into expenses, savings, and investments, predicts financial risk, and tracks goal-based savings.

## Tech stack
- Frontend: HTML, CSS, JavaScript, Chart.js
- Backend: FastAPI (Python)
- Database: SQLite

## Project structure

```text
pocketpilot/
|-- backend/
|   |-- __init__.py
|   |-- database.py
|   |-- main.py
|   |-- schemas.py
|   `-- services.py
|-- static/
|   |-- add-transaction.html
|   |-- analytics.html
|   |-- analytics.js
|   |-- app.js
|   |-- dashboard.js
|   |-- goals.html
|   |-- goals.js
|   |-- index.html
|   |-- styles.css
|   `-- transactions.js
|-- .gitignore
|-- README.md
`-- requirements.txt
```

## Features
- Paste messages like `₹250 debited at Zomato` or `₹500 SIP mutual fund`
- Automatic amount and merchant extraction
- Keyword-based category and bucket detection
- Manual category selection for unknown merchants
- Dashboard cards for expenses, savings, investments, and remaining balance
- Category pie charts with Chart.js
- Spending pattern analysis and overspending warnings
- Future money prediction based on average daily spending
- Smart suggestions for better financial decisions
- Goal-based savings tracker with timeline estimates

## How to run

1. Create and activate a virtual environment:
   - Windows PowerShell:
     ```powershell
     python -m venv .venv
     .\.venv\Scripts\Activate.ps1
     ```

2. Install dependencies:
   ```powershell
   pip install -r requirements.txt
   ```

3. Start the FastAPI server:
   ```powershell
   uvicorn backend.main:app --reload
   ```

4. Open the app in your browser:
   - http://127.0.0.1:8000/

## Main API routes
- `GET /api/health` - health check
- `GET /api/categories` - available manual categories
- `POST /api/parse-transaction` - parse an SMS-style message
- `POST /api/transactions` - save a transaction
- `GET /api/transactions` - list saved transactions
- `GET /api/dashboard` - dashboard summary and recent transactions
- `GET /api/analytics` - deeper analytics and timeline data
- `POST /api/goals` - create a savings goal
- `GET /api/goals` - list goals with progress

## Demo flow suggestion
1. Add a few transactions from the Add Transaction page.
2. Visit the Dashboard page to show totals and alerts.
3. Open Analytics to explain overspending detection and future balance prediction.
4. Create a goal on the Savings Goals page and show the progress bar update.

## Notes
- The app uses SQLite and creates `pocketpilot.db` automatically on first run.
- Remaining balance is calculated as `savings - expenses - investments`.
- Goal progress uses the current remaining balance as available savings.

test change

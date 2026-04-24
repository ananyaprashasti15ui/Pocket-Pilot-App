if (!requireAuth()) throw new Error('unauthenticated');

function getBudgetStorageKeys() {
    const user = getUser();
    const userId = user?.id || 'guest';
    return {
        defaultBudget: `pp_budget_default_${userId}`,
        appliedMonth: `pp_budget_applied_month_${userId}`,
    };
}

function currentYearMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Category definitions with icons and labels
const CATEGORIES = [
    { id: 'Food',          icon: '🍔', label: 'Food'          },
    { id: 'Transport',     icon: '🚗', label: 'Transport'     },
    { id: 'Shopping',      icon: '🛍️', label: 'Shopping'      },
    { id: 'Entertainment', icon: '🎬', label: 'Entertainment' },
    { id: 'Bills',         icon: '💡', label: 'Bills'         },
    { id: 'Health',        icon: '💊', label: 'Health'        },
    { id: 'Education',     icon: '📚', label: 'Education'     },
    { id: 'Subscriptions', icon: '📺', label: 'Subscriptions' },
    { id: 'Clothing',      icon: '👕', label: 'Clothing'      },
    { id: 'Investment',    icon: '📈', label: 'Investment'    },
    { id: 'Savings',       icon: '💰', label: 'Savings'       },
    { id: 'Other',         icon: '💬', label: 'Other'         },
];

// ── Category grid ─────────────────────────────────────────────────────────────

function buildCategoryGrid() {
    const grid = document.getElementById('categoryGrid');
    grid.innerHTML = CATEGORIES.map(cat => `
        <button type="button" class="cat-btn" data-cat="${cat.id}" onclick="selectCategory('${cat.id}')">
            <span class="cat-icon">${cat.icon}</span>
            ${cat.label}
        </button>
    `).join('');
}

function selectCategory(catId) {
    document.querySelectorAll('.cat-btn').forEach(btn => btn.classList.remove('selected'));
    const btn = document.querySelector(`.cat-btn[data-cat="${catId}"]`);
    if (btn) btn.classList.add('selected');
    document.getElementById('selectedCategory').value = catId;
    document.getElementById('catError').textContent = '';
}

// ── Budget widget ─────────────────────────────────────────────────────────────

function renderBudget(b) {
    document.getElementById('budgetMonthLabel').textContent = `Budget – ${b.month_name}`;

    const daysBadge = document.getElementById('daysBadge');
    daysBadge.textContent = `${b.days_left} day${b.days_left !== 1 ? 's' : ''} left in month`;
    daysBadge.className = `days-badge ${b.days_left <= 5 ? 'warn' : 'ok'}`;

    document.getElementById('budgetSpent').textContent = formatCurrency(b.spent_this_month);
    document.getElementById('budgetTotal').textContent = b.budget_amount > 0
        ? formatCurrency(b.budget_amount)
        : 'not set';

    const remaining = document.getElementById('budgetRemaining');
    if (b.budget_amount > 0) {
        remaining.textContent = formatCurrency(b.remaining);
        remaining.style.color = b.remaining <= 0 ? 'var(--danger)' : 'var(--success)';
    } else {
        remaining.textContent = '—';
        remaining.style.color = 'var(--muted)';
    }

    const pct = Math.min(b.percent_used, 100);
    const bar = document.getElementById('budgetBarFill');
    bar.style.width = `${pct}%`;
    bar.className = `budget-bar-fill${b.percent_used >= 90 ? ' danger' : ''}`;
}

async function loadBudget() {
    try {
        const keys = getBudgetStorageKeys();
        const ym = currentYearMonth();
        let budgetData = await apiFetch('/budget');

        if (Number(budgetData.budget_amount || 0) > 0) {
            localStorage.setItem(keys.defaultBudget, String(budgetData.budget_amount));
            localStorage.setItem(keys.appliedMonth, ym);
        } else {
            const storedBudget = Number(localStorage.getItem(keys.defaultBudget) || 0);
            const appliedMonth = localStorage.getItem(keys.appliedMonth);
            if (storedBudget > 0 && appliedMonth !== ym) {
                budgetData = await apiFetch('/budget', {
                    method: 'POST',
                    body: JSON.stringify({ amount: storedBudget }),
                });
                localStorage.setItem(keys.appliedMonth, ym);
            }
        }

        renderBudget(budgetData);
        if (budgetData.budget_amount > 0) {
            document.getElementById('budgetInput').placeholder = `Current: ${formatCurrency(budgetData.budget_amount)}`;
        }
    } catch (_) { /* non-critical */ }
}

async function saveBudget() {
    const val = parseFloat(document.getElementById('budgetInput').value);
    if (!val || val <= 0) return;
    try {
        const keys = getBudgetStorageKeys();
        const b = await apiFetch('/budget', { method: 'POST', body: JSON.stringify({ amount: val }) });
        renderBudget(b);
        localStorage.setItem(keys.defaultBudget, String(val));
        localStorage.setItem(keys.appliedMonth, currentYearMonth());
        document.getElementById('budgetInput').value = '';
        document.getElementById('budgetInput').placeholder = `Current: ${formatCurrency(b.budget_amount)}`;
    } catch (err) {
        alert(err.message);
    }
}

// ── Transaction submit ────────────────────────────────────────────────────────

async function handleTransactionSubmit(event) {
    event.preventDefault();
    const category = document.getElementById('selectedCategory').value;
    if (!category) {
        document.getElementById('catError').textContent = '— please pick a category';
        return;
    }

    const payload = {
        amount: parseFloat(document.getElementById('amountInput').value),
        merchant: document.getElementById('merchantInput').value.trim(),
        category,
        date: document.getElementById('dateInput').value || null,
    };

    const msg = document.getElementById('formMessage');
    msg.innerHTML = '';

    try {
        await apiFetch('/transactions', { method: 'POST', body: JSON.stringify(payload) });
        document.getElementById('transactionForm').reset();
        document.getElementById('selectedCategory').value = '';
        document.querySelectorAll('.cat-btn').forEach(btn => btn.classList.remove('selected'));
        document.getElementById('dateInput').valueAsDate = new Date();
        msg.innerHTML = '<div class="alert suggestion">Transaction saved!</div>';
        await Promise.all([loadTransactions(), loadBudget()]);
    } catch (err) {
        msg.innerHTML = `<div class="alert warning">${err.message}</div>`;
    }
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

let _editId = null;

function openEditModal(t) {
    _editId = t.id;
    document.getElementById('editAmount').value = t.amount;
    document.getElementById('editMerchant').value = t.merchant;
    document.getElementById('editDate').value = t.date;
    // Highlight category
    document.querySelectorAll('.edit-cat-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.cat === t.category);
    });
    document.getElementById('editSelectedCategory').value = t.category;
    document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
    _editId = null;
}

function selectEditCategory(catId) {
    document.querySelectorAll('.edit-cat-btn').forEach(btn => btn.classList.remove('selected'));
    const btn = document.querySelector(`.edit-cat-btn[data-cat="${catId}"]`);
    if (btn) btn.classList.add('selected');
    document.getElementById('editSelectedCategory').value = catId;
}

async function saveEditTransaction() {
    if (!_editId) return;
    const payload = {
        amount: parseFloat(document.getElementById('editAmount').value),
        merchant: document.getElementById('editMerchant').value.trim(),
        category: document.getElementById('editSelectedCategory').value,
        date: document.getElementById('editDate').value || null,
    };
    try {
        await apiFetch(`/transactions/${_editId}`, { method: 'PUT', body: JSON.stringify(payload) });
        closeEditModal();
        await Promise.all([loadTransactions(), loadBudget()]);
    } catch (err) {
        alert(err.message);
    }
}

async function deleteTransaction(id) {
    if (!confirm('Delete this transaction? This cannot be undone.')) return;
    try {
        await apiFetch(`/transactions/${id}`, { method: 'DELETE' });
        await Promise.all([loadTransactions(), loadBudget()]);
    } catch (err) {
        alert(err.message);
    }
}

// ── Load & render transactions ────────────────────────────────────────────────

async function loadTransactions() {
    const transactions = await apiFetch('/transactions');

    // This-month stats
    const now = new Date();
    const ymStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thisMonth = transactions.filter(t => t.date.startsWith(ymStr));
    const monthExpenses = thisMonth.filter(t => t.bucket === 'Expenses').reduce((s, t) => s + t.amount, 0);

    const catCounts = {};
    thisMonth.forEach(t => { catCounts[t.category] = (catCounts[t.category] || 0) + t.amount; });
    const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];

    document.getElementById('monthCount').textContent = thisMonth.length;
    document.getElementById('monthExpenses').textContent = formatCurrency(monthExpenses);
    document.getElementById('monthTopCat').textContent = topCat ? topCat[0] : '—';

    // Recent 5
    const recent = document.getElementById('recentList');
    if (!thisMonth.length) {
        recent.innerHTML = '<div class="empty-state">No transactions this month yet.</div>';
    } else {
        recent.innerHTML = thisMonth.slice(0, 5).map(t => `
            <div class="list-item">
                <div>
                    <strong>${t.merchant}</strong>
                    <span class="muted">${t.category}</span>
                </div>
                <strong>${formatCurrency(t.amount)}</strong>
            </div>`).join('');
    }

    // Full table
    const wrap = document.getElementById('transactionTableWrap');
    if (!transactions.length) {
        wrap.innerHTML = '<div class="empty-state">No transactions yet. Add one using the form above.</div>';
        return;
    }

    wrap.innerHTML = `
        <table class="table">
            <thead>
                <tr><th>Date</th><th>Shop</th><th>Category</th><th>Bucket</th><th>Amount</th><th style="text-align:center;">Actions</th></tr>
            </thead>
            <tbody>
                ${transactions.map(t => `
                    <tr data-id="${t.id}">
                        <td>${t.date}</td>
                        <td>${t.merchant}</td>
                        <td>${t.category}</td>
                        <td><span class="tag ${t.bucket.toLowerCase()}">${t.bucket}</span></td>
                        <td><strong>${formatCurrency(t.amount)}</strong></td>
                        <td style="text-align:center;white-space:nowrap;">
                            <button class="action-btn edit-btn" onclick='openEditModal(${JSON.stringify(t)})' title="Edit">✏️ Edit</button>
                            <button class="action-btn delete-btn" onclick="deleteTransaction(${t.id})" title="Delete">🗑️ Delete</button>
                        </td>
                    </tr>`).join('')}
            </tbody>
        </table>`;
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function initPage() {
    buildCategoryGrid();

    // Build edit modal category grid
    const editGrid = document.getElementById('editCategoryGrid');
    if (editGrid) {
        editGrid.innerHTML = CATEGORIES.map(cat => `
            <button type="button" class="cat-btn edit-cat-btn" data-cat="${cat.id}" onclick="selectEditCategory('${cat.id}')">
                <span class="cat-icon">${cat.icon}</span>
                ${cat.label}
            </button>
        `).join('');
    }

    document.getElementById('dateInput').valueAsDate = new Date();
    document.getElementById('transactionForm').addEventListener('submit', handleTransactionSubmit);

    // Close modal on backdrop click
    const modal = document.getElementById('editModal');
    if (modal) {
        modal.addEventListener('click', (e) => { if (e.target === modal) closeEditModal(); });
    }

    await Promise.all([loadTransactions(), loadBudget()]);
}

initPage();

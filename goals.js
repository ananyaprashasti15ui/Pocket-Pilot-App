if (!requireAuth()) throw new Error('unauthenticated');

let _currentEditGoalId = null;

// ── Modal Handlers ────────────────────────────────────────────────────────────

function openEditGoalModal(goal) {
    _currentEditGoalId = goal.id;
    document.getElementById('editGoalName').value = goal.name;
    document.getElementById('editTargetAmount').value = goal.target_amount;
    document.getElementById('editMonthlySaving').value = goal.monthly_saving_amount || 0;
    document.getElementById('editGoalModal').style.display = 'flex';
}

function closeEditGoalModal() {
    document.getElementById('editGoalModal').style.display = 'none';
    _currentEditGoalId = null;
}

function closeSmartPlanModal() {
    document.getElementById('smartPlanModal').style.display = 'none';
}

async function saveEditGoal() {
    if (!_currentEditGoalId) return;
    
    const payload = {
        name: document.getElementById('editGoalName').value.trim(),
        target_amount: parseFloat(document.getElementById('editTargetAmount').value),
        monthly_saving_amount: parseFloat(document.getElementById('editMonthlySaving').value) || 0,
    };
    
    if (!payload.name || payload.name.length < 2) {
        alert('Goal name must be at least 2 characters');
        return;
    }
    if (!payload.target_amount || payload.target_amount <= 0) {
        alert('Target amount must be greater than 0');
        return;
    }
    
    try {
        await apiFetch(`/goals/${_currentEditGoalId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
        });
        closeEditGoalModal();
        await loadGoals();
    } catch (error) {
        alert(`Error updating goal: ${error.message}`);
    }
}

async function showSmartPlan(goalId) {
    try {
        const suggestion = await apiFetch(`/goals/${goalId}/suggestion`, { method: 'POST' });
        
        let detailsHtml = suggestion.details.map(d => `<div style="margin:6px 0;">✓ ${d}</div>`).join('');
        
        document.getElementById('smartPlanTitle').textContent = suggestion.strategy;
        document.getElementById('smartPlanContent').innerHTML = `
            <div style="line-height: 1.8; font-size: 0.95rem;">
                <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid rgba(37,99,235,0.2);">
                    <strong style="font-size: 1.1rem; color: var(--primary);">
                        ⏱️ Estimated Duration: ${suggestion.estimated_months} months
                    </strong>
                </div>
                
                <div style="margin-bottom: 12px;">
                    <strong style="color: var(--primary); font-size: 0.95rem; display:block; margin-bottom:6px;">Monthly Saving Rate:</strong>
                    <div style="font-size: 1rem; color: var(--success); font-weight: 700;">
                        ₹${formatCurrency(suggestion.monthly_saving_amount)}
                    </div>
                </div>
                
                ${suggestion.expense_reduction > 0 ? `
                    <div style="margin-bottom: 12px; padding: 10px; background: rgba(34,197,94,0.07); border-radius: 8px;">
                        <strong style="color: var(--success);">💰 Expense Reduction Potential:</strong>
                        <div>₹${formatCurrency(suggestion.expense_reduction)} per month</div>
                    </div>
                ` : ''}
                
                <div style="margin-top: 16px; padding: 12px; background: rgba(37,99,235,0.07); border-radius: 8px;">
                    <strong style="color: var(--primary); display: block; margin-bottom: 8px;">📊 Strategy Details:</strong>
                    ${detailsHtml}
                </div>
            </div>
        `;
        
        document.getElementById('smartPlanModal').style.display = 'flex';
    } catch (error) {
        alert(`Error getting smart plan: ${error.message}`);
    }
}

// ── Render goal cards ────────────────────────────────────────────────────────

function renderGoalCards(goals) {
    const container = document.getElementById('goalsContainer');
    if (!goals.length) {
        container.innerHTML = '<div class="empty-state">No savings goals yet. Create one to begin tracking progress.</div>';
        return;
    }

    container.innerHTML = goals
        .map((goal) => {
            const progress = Math.min((goal.amount_saved / goal.target_amount) * 100, 100);
            const depositsHtml = goal.deposits && goal.deposits.length
                ? goal.deposits.map(d => `
                    <div class="deposit-entry">
                        <span class="dep-amount">+ ${formatCurrency(d.amount)}</span>
                        <span class="dep-date">${d.date}</span>
                    </div>`).join('')
                : '<div class="muted" style="font-size:0.85rem;padding:6px 0;">No deposits yet — add your first one below!</div>';

            return `
                <article class="card">
                    <div class="panel-header">
                        <div>
                            <h3>${goal.name}</h3>
                            <p class="muted">Created on ${goal.created_at}</p>
                        </div>
                        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
                            <div class="badge">${progress.toFixed(0)}% funded</div>
                            <button class="goal-edit-btn" onclick="openEditGoalModal(${JSON.stringify(goal)})">✏️ Edit</button>
                            <button class="goal-delete-btn" onclick="deleteGoal(${goal.id})">🗑️ Delete</button>
                        </div>
                    </div>
                    <div class="kpi-grid">
                        <div class="kpi-box">
                            <div class="metric-label">Target</div>
                            <div class="metric-value" style="font-size:1.15rem;">${formatCurrency(goal.target_amount)}</div>
                        </div>
                        <div class="kpi-box">
                            <div class="metric-label">💰 Saved</div>
                            <div class="metric-value" style="font-size:1.15rem;color:var(--success);">${formatCurrency(goal.total_deposited)}</div>
                        </div>
                        <div class="kpi-box">
                            <div class="metric-label">Remaining</div>
                            <div class="metric-value" style="font-size:1.15rem;">${formatCurrency(goal.remaining_amount)}</div>
                        </div>
                        ${goal.monthly_saving_amount > 0 ? `
                        <div class="kpi-box">
                            <div class="metric-label">Monthly Plan</div>
                            <div class="metric-value" style="font-size:0.95rem;color:var(--primary);">₹${formatCurrency(goal.monthly_saving_amount)}</div>
                        </div>
                        ` : ''}
                    </div>
                    <div style="margin-top: 18px;" class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%;"></div>
                    </div>

                    <!-- Deposit history -->
                    <div class="deposit-section">
                        <strong style="font-size:0.88rem;color:var(--muted);">DEPOSIT HISTORY</strong>
                        <div class="deposit-history" id="depositHistory_${goal.id}">
                            ${depositsHtml}
                        </div>
                    </div>

                    <!-- Add deposit form -->
                    <div class="deposit-section">
                        <strong style="font-size:0.88rem;color:var(--muted);">ADD A DEPOSIT</strong>
                        <div class="deposit-row" style="margin-top:10px;">
                            <div class="field">
                                <label>Amount (₹)</label>
                                <input type="number" id="depAmount_${goal.id}" min="1" step="1" placeholder="e.g. 2000">
                            </div>
                            <div class="field">
                                <label>Date</label>
                                <input type="date" id="depDate_${goal.id}" value="${new Date().toISOString().slice(0,10)}">
                            </div>
                            <button class="btn primary" style="height:fit-content;align-self:flex-end;" onclick="addDeposit(${goal.id})">Add</button>
                        </div>
                        <div class="deposit-msg alert suggestion" id="depMsg_${goal.id}" style="display:none;"></div>
                    </div>

                    <!-- Smart Plan Button -->
                    ${goal.monthly_saving_amount > 0 ? `
                    <button class="smart-plan-btn" onclick="showSmartPlan(${goal.id})">
                        🤖 Get Smart Plan
                    </button>
                    ` : ''}
                </article>
            `;
        })
        .join('');
}

// ── Load Goals ───────────────────────────────────────────────────────────────

async function loadGoals() {
    const goals = await apiFetch('/goals');
    renderGoalCards(goals);
}

// ── Create Goal ───────────────────────────────────────────────────────────────

async function handleGoalSubmit(event) {
    event.preventDefault();

    const payload = {
        name: document.getElementById('goalName').value.trim(),
        target_amount: Number(document.getElementById('targetAmount').value),
        monthly_saving_amount: Number(document.getElementById('monthlySaving').value) || 0,
    };

    try {
        await apiFetch('/goals', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        event.target.reset();
        document.getElementById('monthlySaving').value = '0';
        renderAlerts(document.getElementById('goalMessage'), ['Goal created successfully!'], 'suggestion', '');
        await loadGoals();
    } catch (error) {
        renderAlerts(document.getElementById('goalMessage'), [error.message], 'warning', '');
    }
}

// ── Add Deposit ───────────────────────────────────────────────────────────────

async function addDeposit(goalId) {
    const amountInput = document.getElementById(`depAmount_${goalId}`);
    const dateInput = document.getElementById(`depDate_${goalId}`);
    const msgEl = document.getElementById(`depMsg_${goalId}`);

    const amount = parseFloat(amountInput.value);
    if (!amount || amount <= 0) {
        amountInput.style.borderColor = 'var(--danger)';
        return;
    }
    amountInput.style.borderColor = '';

    const payload = {
        amount,
        date: dateInput.value || null,
    };

    try {
        await apiFetch(`/goals/${goalId}/deposit`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        amountInput.value = '';
        msgEl.textContent = `✅ Deposit of ${formatCurrency(amount)} saved!`;
        msgEl.style.display = 'block';
        setTimeout(() => { msgEl.style.display = 'none'; }, 3000);
        
        // Reload goals to show updated progress and smart plan
        await loadGoals();
        
        // Auto-show smart plan if enabled
        const goals = await apiFetch('/goals');
        const updatedGoal = goals.find(g => g.id === goalId);
        if (updatedGoal && updatedGoal.monthly_saving_amount > 0) {
            setTimeout(() => {
                showSmartPlan(goalId);
            }, 500);
        }
    } catch (error) {
        msgEl.textContent = `⚠️ ${error.message}`;
        msgEl.className = 'deposit-msg alert warning';
        msgEl.style.display = 'block';
    }
}

// ── Delete Goal ───────────────────────────────────────────────────────────────

async function deleteGoal(goalId) {
    if (!confirm('Delete this goal and all its deposits? This cannot be undone.')) return;
    try {
        await apiFetch(`/goals/${goalId}`, { method: 'DELETE' });
        await loadGoals();
    } catch (error) {
        alert(error.message);
    }
}

// ── Init ──────────────────────────────────────────────────────────────────────

let _goalsPageInitialized = false;

async function initGoalsPage() {
    if (_goalsPageInitialized) return; // Prevent duplicate listeners
    _goalsPageInitialized = true;
    
    const goalForm = document.getElementById('goalForm');
    const editGoalModal = document.getElementById('editGoalModal');
    const smartPlanModal = document.getElementById('smartPlanModal');
    
    // Form submission - only add once
    goalForm.addEventListener('submit', handleGoalSubmit);
    
    // Close modals on backdrop click - only add once
    editGoalModal.addEventListener('click', (e) => { 
        if (e.target.id === 'editGoalModal') closeEditGoalModal(); 
    });
    smartPlanModal.addEventListener('click', (e) => { 
        if (e.target.id === 'smartPlanModal') closeSmartPlanModal(); 
    });
    
    await loadGoals();
}

// Only initialize once when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGoalsPage);
} else {
    initGoalsPage();
}

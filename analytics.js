if (!requireAuth()) throw new Error('unauthenticated');

const analyticsPalette = ['#0f766e', '#14b8a6', '#f59e0b', '#fb7185', '#2563eb', '#8b5cf6', '#ec4899', '#10b981'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysLeftInMonth() {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return lastDay - now.getDate();
}

function shadeHexColor(hex, percent) {
    const color = hex.replace('#', '');
    const fullHex = color.length === 3
        ? color.split('').map((c) => c + c).join('')
        : color;
    const num = Number.parseInt(fullHex, 16);
    const amt = Math.round(2.55 * percent);
    const r = Math.min(255, Math.max(0, (num >> 16) + amt));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
    const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
    return `rgb(${r}, ${g}, ${b})`;
}

// ── 3D Pie Chart ──────────────────────────────────────────────────────────────

function create3DPieChart(canvasId, labels, values, palette) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    const gradientPalette = palette.map((baseColor) => {
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 320);
        gradient.addColorStop(0, shadeHexColor(baseColor, 18));
        gradient.addColorStop(1, shadeHexColor(baseColor, -14));
        return gradient;
    });

    // Custom plugin for pseudo-3D shadow/depth
    const shadow3dPlugin = {
        id: 'shadow3d',
        beforeDraw(chart) {
            const { ctx } = chart;
            ctx.save();
            ctx.shadowColor = 'rgba(15,118,110,0.35)';
            ctx.shadowBlur = 22;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 12;
        },
        afterDraw(chart) {
            chart.ctx.restore();
        },
    };

    return new Chart(canvas, {
        type: 'pie',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: gradientPalette,
                borderWidth: 3,
                borderColor: 'rgba(255,255,255,0.85)',
                hoverOffset: 16,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { animateRotate: true, duration: 900, easing: 'easeOutQuart' },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        boxWidth: 12,
                        font: { family: 'Manrope', weight: '700' },
                        padding: 16,
                    },
                },
                tooltip: {
                    callbacks: {
                        label(ctx) {
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = ((ctx.parsed / total) * 100).toFixed(1);
                            return ` ${ctx.label}: ₹${ctx.parsed.toLocaleString('en-IN')} (${pct}%)`;
                        },
                    },
                },
            },
        },
        plugins: [shadow3dPlugin],
    });
}

// ── Load Analytics ────────────────────────────────────────────────────────────

async function loadAnalytics() {
    const [data, budget] = await Promise.all([apiFetch('/analytics'), apiFetch('/budget')]);
    _analyticsData = data;

    const daysPassed = Math.max(Number(budget.days_elapsed || 0), 1);
    const totalExpenseSoFar = Number(budget.spent_this_month || 0);
    const averageDailyExpense = totalExpenseSoFar > 0 ? totalExpenseSoFar / daysPassed : 0;
    const remainingBudget = Number(budget.remaining || 0);

    document.getElementById('avgSpendMetric').textContent = formatCurrency(averageDailyExpense);

    let survivalDays = null;
    if (remainingBudget <= 0 && budget.budget_amount > 0) {
        survivalDays = 0;
    } else if (averageDailyExpense > 0 && remainingBudget > 0) {
        survivalDays = Math.floor(remainingBudget / averageDailyExpense);
    }
    document.getElementById('activeDaysMetric').textContent =
        survivalDays !== null ? `${survivalDays} day${survivalDays !== 1 ? 's' : ''}` : 'N/A';

    // "Days left in month" computed client-side
    const dlm = daysLeftInMonth();
    document.getElementById('forecastMetric').textContent = `${dlm} day${dlm !== 1 ? 's' : ''}`;

    document.getElementById('averageSpendBadge').textContent = `Avg daily spend: ${formatCurrency(averageDailyExpense)}`;

    const expenseEntries = Object.entries(data.expense_distribution);
    if (expenseEntries.length) {
        const [topCategory, topValue] = expenseEntries[0];
        const totalExpense = expenseEntries.reduce((sum, [, value]) => sum + Number(value || 0), 0);
        const percentage = totalExpense > 0 ? ((Number(topValue) / totalExpense) * 100).toFixed(2) : '0.00';
        document.getElementById('topCategoryMetric').textContent = `${topCategory} - ${percentage}%`;
    } else {
        document.getElementById('topCategoryMetric').textContent = 'N/A';
    }

    if (expenseEntries.length) {
        create3DPieChart(
            'expenseChart',
            expenseEntries.map(([label]) => label),
            expenseEntries.map(([, value]) => value),
            analyticsPalette,
        );
    } else {
        document.querySelector('#expenseChart').parentElement.innerHTML = '<div class="empty-state">No expense data yet.</div>';
    }

    renderAlerts(document.getElementById('analyticsWarnings'), [...data.warnings, ...data.suggestions], 'suggestion', 'No analytics generated yet.');

    const tableWrap = document.getElementById('analyticsTableWrap');
    if (!data.transactions.length) {
        tableWrap.innerHTML = '<div class="empty-state">No transactions available for analysis.</div>';
        return;
    }

    tableWrap.innerHTML = `
        <table class="table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Merchant</th>
                    <th>Category</th>
                    <th>Bucket</th>
                    <th>Amount</th>
                </tr>
            </thead>
            <tbody>
                ${data.transactions
                    .slice()
                    .reverse()
                    .map(
                        (t) => `
                            <tr>
                                <td>${t.date}</td>
                                <td>${t.merchant}</td>
                                <td>${t.category}</td>
                                <td>${t.bucket}</td>
                                <td>${formatCurrency(t.amount)}</td>
                            </tr>
                        `,
                    )
                    .join('')}
            </tbody>
        </table>
    `;
}

loadAnalytics().catch((error) => {
    document.getElementById('analyticsWarnings').innerHTML = `<div class="alert warning">${error.message}</div>`;
});

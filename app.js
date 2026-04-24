const API_BASE = '/api';
const THEME_KEY = 'pp_theme';

function getToken() {
    return localStorage.getItem('pp_token');
}

function getUser() {
    try { return JSON.parse(localStorage.getItem('pp_user') || 'null'); } catch { return null; }
}

function applyTheme(theme) {
    const normalized = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', normalized);
    const toggle = document.getElementById('themeToggleBtn');
    if (toggle) {
        toggle.setAttribute('aria-label', normalized === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
        toggle.setAttribute('title', normalized === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
    applyTheme(savedTheme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const nextTheme = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, nextTheme);
    applyTheme(nextTheme);
}

function mountThemeToggle() {
    if (document.getElementById('themeToggleBtn')) return;
    const toggle = document.createElement('button');
    toggle.id = 'themeToggleBtn';
    toggle.className = 'theme-toggle';
    toggle.type = 'button';
    toggle.textContent = '🌙';
    toggle.setAttribute('aria-label', 'Toggle dark mode');
    toggle.setAttribute('title', 'Toggle dark mode');
    toggle.addEventListener('click', toggleTheme);
    document.body.appendChild(toggle);
    applyTheme(document.documentElement.getAttribute('data-theme') || 'light');
}

function logout() {
    localStorage.removeItem('pp_token');
    localStorage.removeItem('pp_user');
    window.location.href = '/login';
}

function requireAuth() {
    if (!getToken()) {
        window.location.href = '/login';
        return false;
    }
    const user = getUser();
    const sidebarUser = document.getElementById('sidebarUser');
    if (sidebarUser && user) {
        sidebarUser.innerHTML = `
            <div class="user-row">
                <div class="user-avatar">${user.name.charAt(0).toUpperCase()}</div>
                <div class="user-meta">
                    <div class="user-name">${user.name}</div>
                    <div class="user-email">${user.email}</div>
                </div>
            </div>
            <button class="btn-logout" onclick="logout()">Log out</button>
        `;
    }
    return true;
}

async function apiFetch(path, options = {}) {
    const token = getToken();
    const response = await fetch(`${API_BASE}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...(options.headers || {}),
        },
        ...options,
    });

    if (response.status === 401) {
        logout();
        throw new Error('Session expired. Please log in again.');
    }

    if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(errorPayload.detail || 'Request failed');
    }

    // For 204 No Content, return null instead of trying to parse JSON
    if (response.status === 204) {
        return null;
    }

    return response.json();
}

function formatCurrency(value) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(Number(value || 0));
}

function setActiveNav() {
    const currentPath = window.location.pathname;
    document.querySelectorAll('[data-nav]').forEach((link) => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });
}

function renderAlerts(container, items, type, emptyMessage) {
    if (!container) return;
    if (!items || items.length === 0) {
        container.innerHTML = `<div class="empty-state">${emptyMessage}</div>`;
        return;
    }
    container.innerHTML = items.map((item) => `<div class="alert ${type}">${item}</div>`).join('');
}

function createDoughnutChart(canvasId, labels, values, palette) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    return new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{ data: values, backgroundColor: palette, borderWidth: 0, hoverOffset: 8 }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '64%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { usePointStyle: true, boxWidth: 10, font: { family: 'Manrope', weight: '700' } },
                },
            },
        },
    });
}

setActiveNav();
initTheme();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountThemeToggle);
} else {
    mountThemeToggle();
}

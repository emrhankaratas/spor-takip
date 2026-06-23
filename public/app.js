// ─── State ─────────────────────────────────────────────────
const API = '';
let users = [];
let exercises = [];
let selectedUserId = null;
let selectedExerciseId = null;
let historyUserId = null;
let progressChart = null;

// ─── Color Map ─────────────────────────────────────────────
const colorMap = {
    '#00ff88': 'green',
    '#00aaff': 'blue',
    '#ff6b35': 'orange'
};

function getColorClass(avatarColor) {
    return colorMap[avatarColor] || 'green';
}

// ─── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await loadUsers();
    await loadExercises();
    await loadDashboard();
    setupExerciseSearch();
});

// ─── Tab Switching ─────────────────────────────────────────
function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(btn => btn.classList.remove('active'));

    // Show selected tab
    document.getElementById(`tab-${tabName}`).classList.add('active');
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Load tab data
    if (tabName === 'dashboard') loadDashboard();
    if (tabName === 'history' && historyUserId) loadHistory(historyUserId);
    if (tabName === 'workout' && selectedUserId) loadCurrentSession();
}

// ─── Load Users ────────────────────────────────────────────
async function loadUsers() {
    try {
        const res = await fetch(`${API}/api/users`);
        users = await res.json();
        renderUserSelects();
    } catch (err) {
        console.error('Kullanıcılar yüklenemedi:', err);
    }
}

function renderUserSelects() {
    // Workout tab user select
    const workoutSelect = document.getElementById('user-select');
    workoutSelect.innerHTML = users.map(u => {
        const color = getColorClass(u.avatar_color);
        return `<button class="user-select-btn" data-color="${color}" data-user-id="${u.id}" onclick="selectUser(${u.id})">
            ${u.name}
        </button>`;
    }).join('');

    // History tab user select
    const historySelect = document.getElementById('history-user-select');
    historySelect.innerHTML = users.map(u => {
        const color = getColorClass(u.avatar_color);
        return `<button class="user-select-btn" data-color="${color}" data-user-id="${u.id}" onclick="selectHistoryUser(${u.id})">
            ${u.name}
        </button>`;
    }).join('');
}

function selectUser(userId) {
    selectedUserId = userId;
    document.querySelectorAll('#user-select .user-select-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.userId) === userId);
    });
    loadCurrentSession();
}

function selectHistoryUser(userId) {
    historyUserId = userId;
    document.querySelectorAll('#history-user-select .user-select-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.userId) === userId);
    });
    loadHistory(userId);
    loadStats(userId);
}

// ─── Load Exercises ────────────────────────────────────────
async function loadExercises() {
    try {
        const res = await fetch(`${API}/api/exercises`);
        exercises = await res.json();
        populateProgressSelect();
    } catch (err) {
        console.error('Egzersizler yüklenemedi:', err);
    }
}

function populateProgressSelect() {
    const select = document.getElementById('progress-exercise');
    const grouped = {};
    exercises.forEach(ex => {
        const group = ex.muscle_group || 'Diğer';
        if (!grouped[group]) grouped[group] = [];
        grouped[group].push(ex);
    });

    let html = '<option value="">Egzersiz seç...</option>';
    for (const [group, exList] of Object.entries(grouped)) {
        html += `<optgroup label="${group}">`;
        exList.forEach(ex => {
            html += `<option value="${ex.id}">${ex.name}</option>`;
        });
        html += '</optgroup>';
    }
    select.innerHTML = html;
}

// ─── Exercise Search ───────────────────────────────────────
function setupExerciseSearch() {
    const input = document.getElementById('exercise-search');
    const dropdown = document.getElementById('exercise-dropdown');

    input.addEventListener('focus', () => {
        renderExerciseDropdown(input.value);
        dropdown.classList.remove('hidden');
    });

    input.addEventListener('input', () => {
        renderExerciseDropdown(input.value);
        dropdown.classList.remove('hidden');
    });

    // Close dropdown on click outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-wrapper')) {
            dropdown.classList.add('hidden');
        }
    });
}

function renderExerciseDropdown(filter) {
    const dropdown = document.getElementById('exercise-dropdown');
    const term = filter.toLowerCase().trim();

    let filtered = exercises;
    if (term) {
        filtered = exercises.filter(ex => {
            const nameMatch = ex.name.toLowerCase().includes(term);
            const aliasMatch = ex.aliases && ex.aliases.toLowerCase().includes(term);
            return nameMatch || aliasMatch;
        });
    }

    // Group by muscle group
    const grouped = {};
    filtered.forEach(ex => {
        const group = ex.muscle_group || 'Diğer';
        if (!grouped[group]) grouped[group] = [];
        grouped[group].push(ex);
    });

    let html = '';
    for (const [group, exList] of Object.entries(grouped)) {
        html += `<div class="exercise-dropdown-group">${group}</div>`;
        exList.forEach(ex => {
            html += `<div class="exercise-dropdown-item" onclick="selectExercise(${ex.id}, '${ex.name.replace(/'/g, "\\'")}')">
                <span>${ex.name}</span>
                <span class="muscle-tag">${ex.category || ''}</span>
            </div>`;
        });
    }

    if (filtered.length === 0) {
        html = '<div class="exercise-dropdown-item" style="color: var(--text-muted)">Egzersiz bulunamadı</div>';
    }

    dropdown.innerHTML = html;
}

function selectExercise(id, name) {
    selectedExerciseId = id;
    document.getElementById('exercise-search').value = '';
    document.getElementById('exercise-dropdown').classList.add('hidden');

    const selected = document.getElementById('selected-exercise');
    selected.classList.remove('hidden');
    selected.innerHTML = `
        <span class="selected-exercise-name">✅ ${name}</span>
        <button class="selected-exercise-clear" onclick="clearExercise()">✕</button>
    `;

    // Focus on weight input
    document.getElementById('weight-input').focus();
}

function clearExercise() {
    selectedExerciseId = null;
    document.getElementById('selected-exercise').classList.add('hidden');
    document.getElementById('exercise-search').value = '';
}

// ─── Save Set ──────────────────────────────────────────────
async function saveSet() {
    if (!selectedUserId) {
        showToast('Önce bir kullanıcı seç!', true);
        return;
    }
    if (!selectedExerciseId) {
        showToast('Bir egzersiz seç!', true);
        return;
    }

    const weight = parseFloat(document.getElementById('weight-input').value) || 0;
    const reps = parseInt(document.getElementById('reps-input').value);

    if (!reps || reps <= 0) {
        showToast('Tekrar sayısı gir!', true);
        return;
    }

    try {
        const res = await fetch(`${API}/api/workouts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: selectedUserId,
                exercise_id: selectedExerciseId,
                reps: reps,
                weight_kg: weight
            })
        });

        const data = await res.json();

        if (res.ok) {
            showToast(`${data.exercise_name} — Set ${data.set_number}: ${weight}kg × ${reps}`);

            // Clear inputs
            document.getElementById('reps-input').value = '';
            // Keep weight for convenience (usually same weight across sets)

            // Reload session
            loadCurrentSession();
        } else {
            showToast(data.error || 'Hata oluştu!', true);
        }
    } catch (err) {
        showToast('Bağlantı hatası!', true);
    }
}

// ─── Load Current Session ──────────────────────────────────
async function loadCurrentSession() {
    if (!selectedUserId) return;

    try {
        const res = await fetch(`${API}/api/workouts/today`);
        const data = await res.json();
        const userData = data[selectedUserId];

        const container = document.getElementById('current-session');
        const setsDiv = document.getElementById('session-sets');

        if (!userData || userData.sets.length === 0) {
            container.classList.add('hidden');
            return;
        }

        container.classList.remove('hidden');

        // Group by exercise
        const grouped = {};
        userData.sets.forEach(s => {
            if (!grouped[s.exercise_name]) grouped[s.exercise_name] = [];
            grouped[s.exercise_name].push(s);
        });

        let html = '';
        for (const [exercise, sets] of Object.entries(grouped)) {
            sets.forEach(s => {
                html += `<div class="session-set-item">
                    <div class="session-set-exercise">${exercise}</div>
                    <div class="session-set-detail">
                        Set <strong>${s.set_number}</strong> — 
                        <strong>${s.weight_kg}kg</strong> × <strong>${s.reps}</strong> tekrar
                    </div>
                    <button class="btn btn-danger" onclick="deleteSet(${s.set_id || ''})">🗑️</button>
                </div>`;
            });
        }

        setsDiv.innerHTML = html;
    } catch (err) {
        console.error('Oturum yüklenemedi:', err);
    }
}

// ─── Delete Set ────────────────────────────────────────────
async function deleteSet(setId) {
    if (!setId) return;
    try {
        await fetch(`${API}/api/workouts/set/${setId}`, { method: 'DELETE' });
        showToast('Set silindi');
        loadCurrentSession();
        loadDashboard();
    } catch (err) {
        showToast('Silinemedi!', true);
    }
}

// ─── Dashboard ─────────────────────────────────────────────
async function loadDashboard() {
    await Promise.all([
        loadLeaderboard(),
        loadTodayWorkouts()
    ]);
}

async function loadLeaderboard() {
    try {
        const res = await fetch(`${API}/api/leaderboard`);
        const data = await res.json();
        const container = document.getElementById('leaderboard');

        const medals = ['🥇', '🥈', '🥉'];

        container.innerHTML = data.map((entry, i) => {
            const color = getColorClass(entry.avatar_color);
            const initial = entry.name.charAt(0).toUpperCase();
            return `<div class="leader-card" data-color="${color}">
                <div class="leader-rank">${medals[i] || ''}</div>
                <div class="leader-avatar" style="background: ${entry.avatar_color}">${initial}</div>
                <div class="leader-name">${entry.name}</div>
                <div class="leader-stats">
                    <div class="leader-stat">📅 <span class="leader-stat-value">${entry.total_workouts}</span> gün antrenman</div>
                    <div class="leader-stat">💪 <span class="leader-stat-value">${entry.total_sets}</span> toplam set</div>
                </div>
                <div class="leader-volume" style="color: ${entry.avatar_color}">
                    ${formatNumber(Math.round(entry.total_volume))}
                    <span>kg toplam hacim</span>
                </div>
            </div>`;
        }).join('');
    } catch (err) {
        console.error('Liderlik tablosu yüklenemedi:', err);
    }
}

async function loadTodayWorkouts() {
    try {
        const res = await fetch(`${API}/api/workouts/today`);
        const data = await res.json();
        const container = document.getElementById('today-workouts');

        container.innerHTML = users.map(user => {
            const color = getColorClass(user.avatar_color);
            const userData = data[user.id];
            const sets = userData ? userData.sets : [];
            const initial = user.name.charAt(0).toUpperCase();

            let setsHtml = '';
            if (sets.length === 0) {
                setsHtml = '<div class="today-card-empty">Henüz antrenman yok 😴</div>';
            } else {
                // Group by exercise
                const grouped = {};
                sets.forEach(s => {
                    if (!grouped[s.exercise_name]) grouped[s.exercise_name] = [];
                    grouped[s.exercise_name].push(s);
                });

                for (const [exercise, exerciseSets] of Object.entries(grouped)) {
                    setsHtml += `<div class="today-exercise-group">
                        <div class="today-exercise-name">${exercise}</div>`;
                    exerciseSets.forEach(s => {
                        setsHtml += `<div class="today-set">
                            <span class="today-set-number">${s.set_number}</span>
                            <span class="today-set-weight">${s.weight_kg}kg</span>
                            <span class="today-set-reps">× ${s.reps} tekrar</span>
                        </div>`;
                    });
                    setsHtml += '</div>';
                }
            }

            return `<div class="today-card">
                <div class="today-card-header">
                    <div class="today-card-avatar" style="background: ${user.avatar_color}">${initial}</div>
                    <span class="today-card-name">${user.name}</span>
                </div>
                ${setsHtml}
            </div>`;
        }).join('');

        // Build activity feed
        buildActivityFeed(data);
    } catch (err) {
        console.error('Bugünkü antrenmanlar yüklenemedi:', err);
    }
}

function buildActivityFeed(todayData) {
    const activityDiv = document.getElementById('recent-activity');
    const allSets = [];

    for (const userId in todayData) {
        const user = users.find(u => u.id === parseInt(userId));
        if (!user) continue;
        const sets = todayData[userId].sets || [];
        sets.forEach(s => {
            allSets.push({ ...s, user_name: user.name, avatar_color: user.avatar_color });
        });
    }

    // Sort by time (newest first)
    allSets.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (allSets.length === 0) {
        activityDiv.innerHTML = `<div class="empty-state">
            <div class="empty-state-icon">🏋️</div>
            <p>Bugün henüz kimse antrenman yapmamış. İlk sen başla! 💪</p>
        </div>`;
        return;
    }

    activityDiv.innerHTML = allSets.slice(0, 15).map(s => {
        const time = new Date(s.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        return `<div class="activity-item">
            <div class="activity-dot" style="background: ${s.avatar_color}"></div>
            <div class="activity-text">
                <strong>${s.user_name}</strong> — ${s.exercise_name} ${s.weight_kg}kg × ${s.reps}
            </div>
            <div class="activity-time">${time}</div>
        </div>`;
    }).join('');
}

// ─── History ───────────────────────────────────────────────
async function loadHistory(userId) {
    try {
        const res = await fetch(`${API}/api/workouts/${userId}?days=30`);
        const data = await res.json();
        const container = document.getElementById('history-list');

        if (data.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><p>Henüz antrenman geçmişi yok</p></div>';
            return;
        }

        // Group by date
        const grouped = {};
        data.forEach(item => {
            if (!grouped[item.workout_date]) grouped[item.workout_date] = [];
            grouped[item.workout_date].push(item);
        });

        let html = '';
        for (const [date, items] of Object.entries(grouped)) {
            const formattedDate = formatDate(date);
            html += `<div class="history-date-group">
                <div class="history-date">📅 ${formattedDate}</div>`;

            items.forEach(item => {
                const volume = Math.round(item.weight_kg * item.reps);
                html += `<div class="history-item">
                    <span class="history-exercise">${item.exercise_name}</span>
                    <span class="history-detail">Set ${item.set_number} — ${item.weight_kg}kg × ${item.reps}</span>
                    <span class="history-volume">${volume}kg</span>
                </div>`;
            });

            html += '</div>';
        }

        container.innerHTML = html;
    } catch (err) {
        console.error('Geçmiş yüklenemedi:', err);
    }
}

async function loadStats(userId) {
    try {
        const res = await fetch(`${API}/api/stats/${userId}`);
        const stats = await res.json();
        const container = document.getElementById('stats-cards');

        container.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon">📅</div>
                <div class="stat-value">${stats.totalWorkouts}</div>
                <div class="stat-label">Toplam Gün</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">💪</div>
                <div class="stat-value">${stats.totalSets}</div>
                <div class="stat-label">Toplam Set</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">⚡</div>
                <div class="stat-value">${formatNumber(stats.totalVolume)}</div>
                <div class="stat-label">Toplam Hacim (kg)</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">🔥</div>
                <div class="stat-value">${stats.streak}</div>
                <div class="stat-label">Streak (Gün)</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">⭐</div>
                <div class="stat-value" style="font-size: 1rem">${stats.favoriteExercise}</div>
                <div class="stat-label">En Çok Yapılan</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">📊</div>
                <div class="stat-value">${stats.thisWeekWorkouts}</div>
                <div class="stat-label">Bu Hafta</div>
            </div>
        `;
    } catch (err) {
        console.error('İstatistikler yüklenemedi:', err);
    }
}

// ─── Progress Chart ────────────────────────────────────────
async function loadProgress() {
    const exerciseId = document.getElementById('progress-exercise').value;
    const chartContainer = document.getElementById('progress-chart-container');

    if (!exerciseId || !historyUserId) {
        chartContainer.classList.add('hidden');
        return;
    }

    try {
        const res = await fetch(`${API}/api/progress/${historyUserId}/${exerciseId}?days=90`);
        const data = await res.json();

        if (data.length === 0) {
            chartContainer.classList.add('hidden');
            showToast('Bu egzersiz için veri yok', true);
            return;
        }

        chartContainer.classList.remove('hidden');

        const user = users.find(u => u.id === historyUserId);
        const color = user ? user.avatar_color : '#00ff88';

        // Destroy previous chart
        if (progressChart) progressChart.destroy();

        const ctx = document.getElementById('progress-chart').getContext('2d');

        progressChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => formatDate(d.workout_date)),
                datasets: [
                    {
                        label: 'Maks Ağırlık (kg)',
                        data: data.map(d => d.max_weight),
                        borderColor: color,
                        backgroundColor: color + '20',
                        tension: 0.4,
                        fill: true,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    },
                    {
                        label: 'Toplam Hacim (kg)',
                        data: data.map(d => Math.round(d.total_volume)),
                        borderColor: '#a855f7',
                        backgroundColor: 'rgba(168, 85, 247, 0.1)',
                        tension: 0.4,
                        fill: true,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        labels: {
                            color: 'rgba(240, 240, 245, 0.6)',
                            font: { family: 'Inter' }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: 'rgba(240, 240, 245, 0.35)', font: { family: 'Inter', size: 11 } },
                        grid: { color: 'rgba(255, 255, 255, 0.04)' }
                    },
                    y: {
                        position: 'left',
                        ticks: { color: 'rgba(240, 240, 245, 0.35)', font: { family: 'Inter', size: 11 } },
                        grid: { color: 'rgba(255, 255, 255, 0.04)' },
                        title: {
                            display: true,
                            text: 'Ağırlık (kg)',
                            color: 'rgba(240, 240, 245, 0.35)',
                            font: { family: 'Inter' }
                        }
                    },
                    y1: {
                        position: 'right',
                        ticks: { color: 'rgba(168, 85, 247, 0.5)', font: { family: 'Inter', size: 11 } },
                        grid: { display: false },
                        title: {
                            display: true,
                            text: 'Hacim (kg)',
                            color: 'rgba(168, 85, 247, 0.5)',
                            font: { family: 'Inter' }
                        }
                    }
                }
            }
        });
    } catch (err) {
        console.error('İlerleme yüklenemedi:', err);
    }
}

// ─── Helpers ───────────────────────────────────────────────
function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateObj = new Date(dateStr + 'T00:00:00');

    const diffDays = Math.round((today - dateObj) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Bugün';
    if (diffDays === 1) return 'Dün';
    if (diffDays < 7) return days[date.getDay()];

    return `${date.getDate()} ${months[date.getMonth()]}`;
}

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-message');

    toastMsg.textContent = message;
    toast.classList.remove('hidden', 'error');
    if (isError) toast.classList.add('error');

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ─── Keyboard Shortcuts ────────────────────────────────────
document.addEventListener('keydown', (e) => {
    // Enter to save set (when on workout tab)
    if (e.key === 'Enter' && document.getElementById('tab-workout').classList.contains('active')) {
        const activeEl = document.activeElement;
        if (activeEl.id === 'reps-input' || activeEl.id === 'weight-input') {
            e.preventDefault();
            saveSet();
        }
    }
});

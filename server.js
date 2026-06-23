require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const {
    initDatabase,
    getAll,
    getOne,
    runSql,
    findExerciseByAlias,
    getOrCreateTodayWorkout,
    addSet,
    getTodayWorkoutDetails,
    getWorkoutHistory,
    getUserStats,
    getLeaderboard,
    getExerciseProgress,
    getWeeklySummary
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── API Routes ────────────────────────────────────────────────

// Tüm kullanıcıları getir
app.get('/api/users', (req, res) => {
    try {
        const users = getAll('SELECT * FROM users');
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Tüm egzersizleri getir
app.get('/api/exercises', (req, res) => {
    try {
        const exercises = getAll('SELECT * FROM exercises ORDER BY muscle_group, name');
        res.json(exercises);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Yeni egzersiz ekle
app.post('/api/exercises', (req, res) => {
    try {
        const { name, aliases, category, muscle_group } = req.body;
        if (!name) return res.status(400).json({ error: 'Egzersiz adı gerekli' });

        const result = runSql(
            'INSERT INTO exercises (name, aliases, category, muscle_group) VALUES (?, ?, ?, ?)',
            [name, aliases || '', category || '', muscle_group || '']
        );

        const exercise = getOne('SELECT * FROM exercises WHERE id = ?', [result.lastInsertRowid]);
        res.json(exercise);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Bugünkü tüm antrenmanları getir
app.get('/api/workouts/today', (req, res) => {
    try {
        const users = getAll('SELECT * FROM users');
        const result = {};

        for (const user of users) {
            result[user.id] = {
                user,
                sets: getTodayWorkoutDetails(user.id)
            };
        }

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Kullanıcının antrenman geçmişini getir
app.get('/api/workouts/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const days = parseInt(req.query.days) || 30;
        const history = getWorkoutHistory(parseInt(userId), days);
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Yeni set ekle
app.post('/api/workouts', (req, res) => {
    try {
        const { user_id, exercise_id, reps, weight_kg } = req.body;

        if (!user_id || !exercise_id || !reps) {
            return res.status(400).json({ error: 'user_id, exercise_id ve reps gerekli' });
        }

        const workout = getOrCreateTodayWorkout(parseInt(user_id));
        const set = addSet(workout.id, parseInt(exercise_id), parseInt(reps), parseFloat(weight_kg) || 0);

        const exercise = getOne('SELECT name FROM exercises WHERE id = ?', [parseInt(exercise_id)]);

        res.json({
            ...set,
            exercise_name: exercise ? exercise.name : 'Bilinmeyen',
            workout_date: workout.workout_date
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Toplu set ekle
app.post('/api/workouts/bulk', (req, res) => {
    try {
        const { user_id, sets } = req.body;

        if (!user_id || !sets || !Array.isArray(sets)) {
            return res.status(400).json({ error: 'user_id ve sets dizisi gerekli' });
        }

        const workout = getOrCreateTodayWorkout(parseInt(user_id));
        const results = [];

        for (const s of sets) {
            const set = addSet(workout.id, parseInt(s.exercise_id), parseInt(s.reps), parseFloat(s.weight_kg) || 0);
            const exercise = getOne('SELECT name FROM exercises WHERE id = ?', [parseInt(s.exercise_id)]);
            results.push({
                ...set,
                exercise_name: exercise ? exercise.name : 'Bilinmeyen'
            });
        }

        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Set sil
app.delete('/api/workouts/set/:setId', (req, res) => {
    try {
        const { setId } = req.params;
        runSql('DELETE FROM workout_sets WHERE id = ?', [parseInt(setId)]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Kullanıcı istatistikleri
app.get('/api/stats/:userId', (req, res) => {
    try {
        const stats = getUserStats(parseInt(req.params.userId));
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Liderlik tablosu
app.get('/api/leaderboard', (req, res) => {
    try {
        const leaderboard = getLeaderboard();
        res.json(leaderboard);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Egzersiz ilerleme
app.get('/api/progress/:userId/:exerciseId', (req, res) => {
    try {
        const { userId, exerciseId } = req.params;
        const days = parseInt(req.query.days) || 90;
        const progress = getExerciseProgress(parseInt(userId), parseInt(exerciseId), days);
        res.json(progress);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Haftalık özet
app.get('/api/weekly/:userId', (req, res) => {
    try {
        const summary = getWeeklySummary(parseInt(req.params.userId));
        res.json(summary);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Antrenman takvimi
app.get('/api/calendar/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const months = parseInt(req.query.months) || 3;
        const data = getAll(`
            SELECT 
                w.workout_date,
                COUNT(ws.id) as set_count,
                COALESCE(SUM(ws.reps * ws.weight_kg), 0) as volume
            FROM workouts w
            LEFT JOIN workout_sets ws ON w.id = ws.workout_id
            WHERE w.user_id = ?
            AND w.workout_date >= date('now', '-' || ? || ' months')
            GROUP BY w.workout_date
            ORDER BY w.workout_date ASC
        `, [parseInt(userId), months]);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Belirli tarihteki antrenmanlar
app.get('/api/workouts/:userId/date/:date', (req, res) => {
    try {
        const { userId, date } = req.params;
        const data = getAll(`
            SELECT 
                ws.id as set_id, ws.set_number, ws.reps, ws.weight_kg, ws.created_at,
                e.name as exercise_name, e.muscle_group
            FROM workout_sets ws
            JOIN workouts w ON ws.workout_id = w.id
            JOIN exercises e ON ws.exercise_id = e.id
            WHERE w.user_id = ? AND w.workout_date = ?
            ORDER BY ws.created_at ASC
        `, [parseInt(userId), date]);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Başlat ────────────────────────────────────────────────────
async function start() {
    await initDatabase();

    app.listen(PORT, () => {
        console.log('');
        console.log('🏋️  ═══════════════════════════════════════════');
        console.log('🏋️  Kuzenler Spor Takip Sistemi');
        console.log(`🏋️  http://localhost:${PORT}`);
        console.log('🏋️  ═══════════════════════════════════════════');
        console.log('');

        // Bot'u başlat (token varsa)
        if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN.length > 10) {
            try {
                require('./bot');
                console.log('🤖 Telegram botu başlatıldı!');
            } catch (err) {
                console.log('⚠️  Telegram botu başlatılamadı:', err.message);
            }
        } else {
            console.log('ℹ️  Telegram bot token ayarlanmamış. Bot devre dışı.');
            console.log('   .env dosyasına TELEGRAM_BOT_TOKEN ekleyin.');
        }
    });
}

start().catch(err => {
    console.error('Başlatma hatası:', err);
    process.exit(1);
});

module.exports = app;

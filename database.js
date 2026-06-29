require('dotenv').config();
const { createClient } = require('@libsql/client');

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function initDatabase() {
    await client.execute(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        telegram_chat_id TEXT,
        avatar_color TEXT DEFAULT '#00ff88',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await client.execute(`CREATE TABLE IF NOT EXISTS exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        aliases TEXT,
        category TEXT,
        muscle_group TEXT
    )`);

    await client.execute(`CREATE TABLE IF NOT EXISTS workouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        workout_date DATE NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    await client.execute(`CREATE TABLE IF NOT EXISTS workout_sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_id INTEGER NOT NULL,
        exercise_id INTEGER NOT NULL,
        set_number INTEGER NOT NULL,
        reps INTEGER NOT NULL,
        weight_kg REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (workout_id) REFERENCES workouts(id),
        FOREIGN KEY (exercise_id) REFERENCES exercises(id)
    )`);

    const userRow = await client.execute('SELECT COUNT(*) as count FROM users');
    if (userRow.rows[0].count === 0) {
        await client.execute("INSERT INTO users (name, avatar_color) VALUES ('Emirhan', '#00ff88')");
        await client.execute("INSERT INTO users (name, avatar_color) VALUES ('Alikaan', '#00aaff')");
        await client.execute("INSERT INTO users (name, avatar_color) VALUES ('Aykan', '#ff6b35')");
        console.log('✅ Kullanıcılar oluşturuldu: Emirhan, Alikaan, Aykan');
    }

    const exRow = await client.execute('SELECT COUNT(*) as count FROM exercises');
    if (exRow.rows[0].count === 0) {
        await seedExercises();
    }

    console.log('✅ Veritabanı hazır');
}

async function seedExercises() {
    const exercises = [
        ['Bench Press', 'bench,bench press,göğüs press,bp', 'Compound', 'Göğüs'],
        ['Incline Bench Press', 'incline bench,incline press,incline,üst göğüs', 'Compound', 'Göğüs'],
        ['Decline Bench Press', 'decline bench,decline press,decline,alt göğüs', 'Compound', 'Göğüs'],
        ['Dumbbell Press', 'dumbbell press,db press,dumbbell', 'Compound', 'Göğüs'],
        ['Dumbbell Fly', 'fly,chest fly,dumbbell fly', 'Isolation', 'Göğüs'],
        ['Cable Crossover', 'crossover,cable cross', 'Isolation', 'Göğüs'],
        ['Chest Dips', 'chest dips,chest dip', 'Compound', 'Göğüs'],
        ['Push Up', 'push up,pushup,şınav', 'Compound', 'Göğüs'],
        ['Barbell Row', 'row,barbell row,sırt row,bent over row', 'Compound', 'Sırt'],
        ['Lat Pulldown', 'lat,lat pulldown,pulldown', 'Compound', 'Sırt'],
        ['Seated Cable Row', 'seated row,cable row,oturarak row', 'Compound', 'Sırt'],
        ['Deadlift', 'deadlift,dead,ölü çekiş,dl', 'Compound', 'Sırt'],
        ['Pull Up', 'pull up,pullup,barfiks', 'Compound', 'Sırt'],
        ['Chin Up', 'chin up,chinup', 'Compound', 'Sırt'],
        ['T-Bar Row', 't-bar,tbar,t bar row,t bar', 'Compound', 'Sırt'],
        ['Face Pull', 'face pull,facepull', 'Isolation', 'Sırt'],
        ['Dumbbell Row', 'db row,dumbbell row,tek kol row', 'Compound', 'Sırt'],
        ['Shoulder Press', 'shoulder press,overhead press,omuz press,military press,ohp', 'Compound', 'Omuz'],
        ['Dumbbell Shoulder Press', 'db shoulder,db omuz,dumbbell omuz', 'Compound', 'Omuz'],
        ['Lateral Raise', 'lateral,lateral raise,yan kaldırma,yan raise', 'Isolation', 'Omuz'],
        ['Front Raise', 'front raise,ön kaldırma,ön raise', 'Isolation', 'Omuz'],
        ['Rear Delt Fly', 'rear delt,rear fly,arka omuz', 'Isolation', 'Omuz'],
        ['Shrug', 'shrug,trapez,omuz silkme', 'Isolation', 'Omuz'],
        ['Arnold Press', 'arnold,arnold press', 'Compound', 'Omuz'],
        ['Bicep Curl', 'curl,bicep curl,bicep,pazu,barbell curl', 'Isolation', 'Kol'],
        ['Hammer Curl', 'hammer,hammer curl,çekiç curl', 'Isolation', 'Kol'],
        ['Preacher Curl', 'preacher,preacher curl,scott curl', 'Isolation', 'Kol'],
        ['Concentration Curl', 'concentration,concentration curl', 'Isolation', 'Kol'],
        ['EZ Bar Curl', 'ez curl,ez bar,ez bar curl', 'Isolation', 'Kol'],
        ['Cable Curl', 'cable curl,kablo curl', 'Isolation', 'Kol'],
        ['Tricep Extension', 'tricep,tricep extension,tricep ext', 'Isolation', 'Kol'],
        ['Tricep Pushdown', 'pushdown,tricep pushdown', 'Isolation', 'Kol'],
        ['Skull Crusher', 'skull crusher,skull,skullcrusher', 'Isolation', 'Kol'],
        ['Close Grip Bench', 'close grip,cgbp,close grip bench', 'Compound', 'Kol'],
        ['Overhead Tricep Extension', 'overhead tricep,overhead ext', 'Isolation', 'Kol'],
        ['Dips', 'dips,dip,paralel', 'Compound', 'Kol'],
        ['Squat', 'squat,skuat,çömelme', 'Compound', 'Bacak'],
        ['Front Squat', 'front squat,ön squat', 'Compound', 'Bacak'],
        ['Leg Press', 'leg press,bacak press', 'Compound', 'Bacak'],
        ['Leg Extension', 'leg extension,bacak extension,bacak ext', 'Isolation', 'Bacak'],
        ['Leg Curl', 'leg curl,bacak curl', 'Isolation', 'Bacak'],
        ['Calf Raise', 'calf raise,calf,baldır', 'Isolation', 'Bacak'],
        ['Lunge', 'lunge,lunges,hamle', 'Compound', 'Bacak'],
        ['Romanian Deadlift', 'rdl,romanian deadlift,romanya,romanian', 'Compound', 'Bacak'],
        ['Hip Thrust', 'hip thrust,kalça,glute bridge', 'Compound', 'Bacak'],
        ['Bulgarian Split Squat', 'bulgarian,split squat', 'Compound', 'Bacak'],
        ['Hack Squat', 'hack squat,hack', 'Compound', 'Bacak'],
        ['Plank', 'plank', 'Core', 'Karın'],
        ['Crunch', 'crunch,mekik', 'Core', 'Karın'],
        ['Russian Twist', 'russian twist,twist', 'Core', 'Karın'],
        ['Leg Raise', 'leg raise,bacak kaldırma', 'Core', 'Karın'],
        ['Ab Wheel', 'ab wheel,tekerlek', 'Core', 'Karın'],
        ['Cable Crunch', 'cable crunch,kablo crunch', 'Core', 'Karın'],
    ];

    for (const [name, aliases, category, muscle] of exercises) {
        await client.execute({
            sql: 'INSERT INTO exercises (name, aliases, category, muscle_group) VALUES (?, ?, ?, ?)',
            args: [name, aliases, category, muscle]
        });
    }
    console.log(`✅ ${exercises.length} egzersiz oluşturuldu`);
}

function saveDatabase() {} // Turso bulutta, kaydetmeye gerek yok

async function getOne(sql, params = []) {
    const result = await client.execute({ sql, args: params });
    return result.rows[0] || null;
}

async function getAll(sql, params = []) {
    const result = await client.execute({ sql, args: params });
    return result.rows;
}

async function runSql(sql, params = []) {
    const result = await client.execute({ sql, args: params });
    return { lastInsertRowid: result.lastInsertRowid };
}

async function findExerciseByAlias(searchTerm) {
    const term = searchTerm.toLowerCase().trim();
    const exercises = await getAll('SELECT * FROM exercises');
    for (const ex of exercises) {
        if (ex.name.toLowerCase() === term) return ex;
        const aliases = ex.aliases ? ex.aliases.split(',').map(a => a.trim().toLowerCase()) : [];
        if (aliases.includes(term)) return ex;
    }
    for (const ex of exercises) {
        if (ex.name.toLowerCase().includes(term)) return ex;
        const aliases = ex.aliases ? ex.aliases.split(',').map(a => a.trim().toLowerCase()) : [];
        for (const alias of aliases) {
            if (alias.includes(term) || term.includes(alias)) return ex;
        }
    }
    return null;
}

async function getOrCreateTodayWorkout(userId) {
    const today = new Date().toISOString().split('T')[0];
    let workout = await getOne('SELECT * FROM workouts WHERE user_id = ? AND workout_date = ?', [userId, today]);
    if (!workout) {
        const result = await runSql('INSERT INTO workouts (user_id, workout_date) VALUES (?, ?)', [userId, today]);
        workout = await getOne('SELECT * FROM workouts WHERE id = ?', [result.lastInsertRowid]);
    }
    return workout;
}

async function getNextSetNumber(workoutId, exerciseId) {
    const result = await getOne(
        'SELECT MAX(set_number) as max_set FROM workout_sets WHERE workout_id = ? AND exercise_id = ?',
        [workoutId, exerciseId]
    );
    return (result?.max_set || 0) + 1;
}

async function addSet(workoutId, exerciseId, reps, weightKg) {
    const setNumber = await getNextSetNumber(workoutId, exerciseId);
    const result = await runSql(
        'INSERT INTO workout_sets (workout_id, exercise_id, set_number, reps, weight_kg) VALUES (?, ?, ?, ?, ?)',
        [workoutId, exerciseId, setNumber, reps, weightKg]
    );
    return { id: result.lastInsertRowid, set_number: setNumber, reps, weight_kg: weightKg };
}

async function getTodayWorkoutDetails(userId) {
    const today = new Date().toISOString().split('T')[0];
    return getAll(`
        SELECT ws.id as set_id, ws.set_number, ws.reps, ws.weight_kg, ws.created_at,
               e.name as exercise_name, e.muscle_group, w.workout_date
        FROM workout_sets ws
        JOIN workouts w ON ws.workout_id = w.id
        JOIN exercises e ON ws.exercise_id = e.id
        WHERE w.user_id = ? AND w.workout_date = ?
        ORDER BY ws.created_at ASC
    `, [userId, today]);
}

async function getWorkoutHistory(userId, days = 30) {
    return getAll(`
        SELECT w.workout_date, e.name as exercise_name, e.muscle_group,
               ws.set_number, ws.reps, ws.weight_kg, ws.created_at
        FROM workout_sets ws
        JOIN workouts w ON ws.workout_id = w.id
        JOIN exercises e ON ws.exercise_id = e.id
        WHERE w.user_id = ?
        AND w.workout_date >= date('now', '-' || ? || ' days')
        ORDER BY w.workout_date DESC, ws.created_at ASC
    `, [userId, days]);
}

async function getUserStats(userId) {
    const r1 = await getOne('SELECT COUNT(DISTINCT workout_date) as count FROM workouts WHERE user_id = ?', [userId]);
    const r2 = await getOne('SELECT COUNT(*) as count FROM workout_sets ws JOIN workouts w ON ws.workout_id = w.id WHERE w.user_id = ?', [userId]);
    const r3 = await getOne('SELECT COALESCE(SUM(ws.reps * ws.weight_kg), 0) as volume FROM workout_sets ws JOIN workouts w ON ws.workout_id = w.id WHERE w.user_id = ?', [userId]);
    const r4 = await getOne('SELECT e.name, COUNT(*) as count FROM workout_sets ws JOIN workouts w ON ws.workout_id = w.id JOIN exercises e ON ws.exercise_id = e.id WHERE w.user_id = ? GROUP BY e.id ORDER BY count DESC LIMIT 1', [userId]);
    const r5 = await getOne("SELECT COUNT(DISTINCT workout_date) as count FROM workouts w JOIN workout_sets ws ON w.id = ws.workout_id WHERE w.user_id = ? AND w.workout_date >= date('now', 'weekday 0', '-7 days')", [userId]);
    const dates = await getAll('SELECT DISTINCT workout_date FROM workouts w JOIN workout_sets ws ON w.id = ws.workout_id WHERE w.user_id = ? ORDER BY workout_date DESC', [userId]);

    let streak = 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 0; i < dates.length; i++) {
        const expected = new Date(today);
        expected.setDate(expected.getDate() - i);
        if (dates[i].workout_date === expected.toISOString().split('T')[0]) streak++;
        else break;
    }

    return {
        totalWorkouts: r1.count, totalSets: r2.count,
        totalVolume: Math.round(r3.volume), streak,
        favoriteExercise: r4 ? r4.name : '-', thisWeekWorkouts: r5.count
    };
}

async function getLeaderboard() {
    return getAll(`
        SELECT u.id, u.name, u.avatar_color,
               COUNT(DISTINCT w.workout_date) as total_workouts,
               COUNT(ws.id) as total_sets,
               COALESCE(SUM(ws.reps * ws.weight_kg), 0) as total_volume
        FROM users u
        LEFT JOIN workouts w ON u.id = w.user_id
        LEFT JOIN workout_sets ws ON w.id = ws.workout_id
        GROUP BY u.id ORDER BY total_volume DESC
    `);
}

async function getExerciseProgress(userId, exerciseId, days = 90) {
    return getAll(`
        SELECT w.workout_date, MAX(ws.weight_kg) as max_weight,
               MAX(ws.reps) as max_reps, SUM(ws.reps * ws.weight_kg) as total_volume
        FROM workout_sets ws
        JOIN workouts w ON ws.workout_id = w.id
        WHERE w.user_id = ? AND ws.exercise_id = ?
        AND w.workout_date >= date('now', '-' || ? || ' days')
        GROUP BY w.workout_date ORDER BY w.workout_date ASC
    `, [userId, exerciseId, days]);
}

async function getWeeklySummary(userId) {
    return getAll(`
        SELECT w.workout_date, COUNT(ws.id) as set_count,
               COALESCE(SUM(ws.reps * ws.weight_kg), 0) as daily_volume
        FROM workouts w
        LEFT JOIN workout_sets ws ON w.id = ws.workout_id
        WHERE w.user_id = ? AND w.workout_date >= date('now', 'weekday 0', '-7 days')
        GROUP BY w.workout_date ORDER BY w.workout_date ASC
    `, [userId]);
}

async function getUserByChatId(chatId) {
    return getOne('SELECT * FROM users WHERE telegram_chat_id = ?', [String(chatId)]);
}

async function linkTelegramUser(userId, chatId) {
    return runSql('UPDATE users SET telegram_chat_id = ? WHERE id = ?', [String(chatId), userId]);
}

module.exports = {
    initDatabase, getOne, getAll, runSql, saveDatabase,
    findExerciseByAlias, getOrCreateTodayWorkout, getNextSetNumber,
    addSet, getTodayWorkoutDetails, getWorkoutHistory, getUserStats,
    getLeaderboard, getExerciseProgress, getWeeklySummary,
    getUserByChatId, linkTelegramUser, getOrCreateExercise
};

async function getOrCreateExercise(name) {
    // Önce tam eşleşme ara
    let exercise = await getOne('SELECT * FROM exercises WHERE LOWER(name) = LOWER(?)', [name]);
    if (exercise) return exercise;

    // Yoksa yeni oluştur
    const result = await runSql(
        'INSERT INTO exercises (name, aliases, category, muscle_group) VALUES (?, ?, ?, ?)',
        [name, '', 'Custom', 'Diğer']
    );
    return await getOne('SELECT * FROM exercises WHERE id = ?', [result.lastInsertRowid]);
}
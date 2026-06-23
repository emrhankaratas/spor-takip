require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const {
    initDatabase,
    getAll,
    runSql,
    findExerciseByAlias,
    getOrCreateTodayWorkout,
    addSet,
    getTodayWorkoutDetails,
    getUserStats,
    getUserByChatId,
    linkTelegramUser,
    getWeeklySummary,
    getLeaderboard
} = require('./database');

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token || token === 'YOUR_BOT_TOKEN_HERE') {
    console.log('⚠️  TELEGRAM_BOT_TOKEN ayarlanmamış. .env dosyasını kontrol et.');
    process.exit(1);
}

// Veritabanını başlat, sonra botu çalıştır
initDatabase().then(() => {
    const bot = new TelegramBot(token, { polling: true });
    console.log('🤖 Telegram botu çalışıyor...');

    // ─── /start ────────────────────────────────────────────────
    bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        const user = await getUserByChatId(chatId);

        if (user) {
            bot.sendMessage(chatId,
                `Tekrar hoş geldin *${user.name}*! 💪\n\n` +
                `Antrenmanını kaydetmek için direkt yaz:\n` +
                `\`row 70 2\` → Barbell Row, 70kg, 2 tekrar\n\n` +
                `Komutlar: /bugun /hafta /skor /yardim`,
                { parse_mode: 'Markdown' }
            );
        } else {
            const allUsers = await getAll('SELECT * FROM users');
            const keyboard = allUsers.map(u => [{ text: u.name, callback_data: `link_${u.id}` }]);
            bot.sendMessage(chatId,
                '🏋️ *Kuzenler Spor Takip Botu*\n\nSen kimsin?',
                { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } }
            );
        }
    });

    // ─── Kullanıcı Bağlama ──────────────────────────────────────
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;

        if (data.startsWith('link_')) {
            const userId = parseInt(data.split('_')[1]);
            await linkTelegramUser(userId, chatId);
            const allUsers = await getAll('SELECT * FROM users WHERE id = ?', [userId]);
            const user = allUsers[0];

            bot.answerCallbackQuery(query.id);
            bot.sendMessage(chatId,
                `✅ Hoş geldin *${user.name}*!\n\n` +
                `Artık antrenmanını buradan kaydedebilirsin.\n\n` +
                `📝 *Kullanım:*\n` +
                `\`row 70 2\` → Barbell Row, 70kg, 2 tekrar\n` +
                `\`bench 80 5\` → Bench Press, 80kg, 5 tekrar\n` +
                `\`squat 100 8\` → Squat, 100kg, 8 tekrar\n\n` +
                `Komutlar: /bugun /hafta /skor /yardim`,
                { parse_mode: 'Markdown' }
            );
        }
    });

    // ─── /yardim ───────────────────────────────────────────────
    bot.onText(/\/yardim|\/help/, (msg) => {
        bot.sendMessage(msg.chat.id,
            `🏋️ *Spor Takip Botu*\n\n` +
            `📝 *Antrenman Kaydetme:*\n` +
            `\`egzersiz ağırlık tekrar\`\n\n` +
            `*Örnekler:*\n` +
            `\`row 70 2\` → Row, 70kg, 2 tekrar\n` +
            `\`bench 80 5\` → Bench Press, 80kg, 5 tekrar\n` +
            `\`squat 100 8\` → Squat, 100kg, 8 tekrar\n\n` +
            `📊 *Komutlar:*\n` +
            `/bugun — Bugünkü antrenmanın\n` +
            `/hafta — Haftalık özet\n` +
            `/skor — Kuzenler liderlik tablosu\n` +
            `/egzersizler — Egzersiz listesi\n` +
            `/sil — Son seti sil\n` +
            `/hesap — İstatistiklerin\n` +
            `/yardim — Bu mesaj`,
            { parse_mode: 'Markdown' }
        );
    });

    // ─── /bugun ────────────────────────────────────────────────
    bot.onText(/\/bugun|\/today/, async (msg) => {
        const chatId = msg.chat.id;
        const user = await getUserByChatId(chatId);
        if (!user) { bot.sendMessage(chatId, '❌ Önce /start ile hesabını bağla.'); return; }

        const sets = await getTodayWorkoutDetails(user.id);
        if (sets.length === 0) {
            bot.sendMessage(chatId, `📭 *${user.name}*, bugün henüz antrenman yapmamışsın.\n\nHadi başla! 💪`, { parse_mode: 'Markdown' });
            return;
        }

        const grouped = {};
        for (const s of sets) {
            if (!grouped[s.exercise_name]) grouped[s.exercise_name] = [];
            grouped[s.exercise_name].push(s);
        }

        let message = `📋 *${user.name} — Bugünkü Antrenman*\n📅 ${sets[0].workout_date}\n\n`;
        for (const [exercise, exerciseSets] of Object.entries(grouped)) {
            message += `🏋️ *${exercise}*\n`;
            for (const s of exerciseSets) {
                message += `   Set ${s.set_number}: ${s.weight_kg}kg × ${s.reps} tekrar\n`;
            }
            message += '\n';
        }
        const totalVolume = sets.reduce((sum, s) => sum + (s.weight_kg * s.reps), 0);
        message += `📊 Toplam: ${sets.length} set | ${Math.round(totalVolume)}kg hacim`;
        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    });

    // ─── /hafta ────────────────────────────────────────────────
    bot.onText(/\/hafta|\/week/, async (msg) => {
        const chatId = msg.chat.id;
        const user = await getUserByChatId(chatId);
        if (!user) { bot.sendMessage(chatId, '❌ Önce /start ile hesabını bağla.'); return; }

        const summary = await getWeeklySummary(user.id);
        if (summary.length === 0) {
            bot.sendMessage(chatId, `📭 *${user.name}*, bu hafta henüz antrenman yapmamışsın.`, { parse_mode: 'Markdown' });
            return;
        }

        const days = ['Pzr', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
        let message = `📊 *${user.name} — Haftalık Özet*\n\n`;
        for (const day of summary) {
            const date = new Date(day.workout_date);
            const dayName = days[date.getDay()];
            const bar = '█'.repeat(Math.min(Math.ceil(day.daily_volume / 500), 10));
            message += `${dayName} ${day.workout_date.slice(5)}: ${day.set_count} set | ${Math.round(day.daily_volume)}kg ${bar}\n`;
        }
        message += `\n💪 Bu hafta *${summary.length}* gün antrenman yaptın!`;
        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    });

    // ─── /skor ─────────────────────────────────────────────────
    bot.onText(/\/skor|\/score|\/leaderboard/, async (msg) => {
        const leaderboard = await getLeaderboard();
        const medals = ['🥇', '🥈', '🥉'];
        let message = `🏆 *Kuzenler Liderlik Tablosu*\n\n`;
        leaderboard.forEach((entry, i) => {
            message += `${medals[i] || '  '} *${entry.name}*\n`;
            message += `   📅 ${entry.total_workouts} gün | 💪 ${entry.total_sets} set | ⚡ ${Math.round(entry.total_volume)}kg\n\n`;
        });
        bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
    });

    // ─── /hesap ────────────────────────────────────────────────
    bot.onText(/\/hesap|\/stats/, async (msg) => {
        const chatId = msg.chat.id;
        const user = await getUserByChatId(chatId);
        if (!user) { bot.sendMessage(chatId, '❌ Önce /start ile hesabını bağla.'); return; }

        const stats = await getUserStats(user.id);
        let message = `📊 *${user.name} — İstatistikler*\n\n`;
        message += `📅 Toplam Antrenman: *${stats.totalWorkouts}* gün\n`;
        message += `💪 Toplam Set: *${stats.totalSets}*\n`;
        message += `⚡ Toplam Hacim: *${stats.totalVolume}* kg\n`;
        message += `🔥 Streak: *${stats.streak}* gün\n`;
        message += `⭐ En Çok Yapılan: *${stats.favoriteExercise}*\n`;
        message += `📅 Bu Hafta: *${stats.thisWeekWorkouts}* gün\n`;
        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    });

    // ─── /egzersizler ──────────────────────────────────────────
    bot.onText(/\/egzersizler|\/exercises/, async (msg) => {
        const exercises = await getAll('SELECT name, muscle_group FROM exercises ORDER BY muscle_group, name');
        const grouped = {};
        for (const ex of exercises) {
            const group = ex.muscle_group || 'Diğer';
            if (!grouped[group]) grouped[group] = [];
            grouped[group].push(ex.name);
        }
        let message = `📋 *Egzersiz Listesi*\n\n`;
        for (const [group, names] of Object.entries(grouped)) {
            message += `*${group}:*\n`;
            message += names.map(n => `  • ${n}`).join('\n') + '\n\n';
        }
        message += `💡 Kısa isimlerle yazabilirsin:\n\`row\`, \`bench\`, \`squat\`, \`curl\` vb.`;
        bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
    });

    // ─── /sil ──────────────────────────────────────────────────
    bot.onText(/\/sil|\/undo/, async (msg) => {
        const chatId = msg.chat.id;
        const user = await getUserByChatId(chatId);
        if (!user) { bot.sendMessage(chatId, '❌ Önce /start ile hesabını bağla.'); return; }

        const lastSet = await require('./database').getOne(`
            SELECT ws.id, ws.set_number, ws.reps, ws.weight_kg, e.name as exercise_name
            FROM workout_sets ws
            JOIN workouts w ON ws.workout_id = w.id
            JOIN exercises e ON ws.exercise_id = e.id
            WHERE w.user_id = ?
            ORDER BY ws.created_at DESC
            LIMIT 1
        `, [user.id]);

        if (!lastSet) { bot.sendMessage(chatId, '❌ Silinecek set bulunamadı.'); return; }

        await runSql('DELETE FROM workout_sets WHERE id = ?', [lastSet.id]);
        bot.sendMessage(chatId,
            `🗑️ Silindi: *${lastSet.exercise_name}* Set ${lastSet.set_number} (${lastSet.weight_kg}kg × ${lastSet.reps})`,
            { parse_mode: 'Markdown' }
        );
    });

    // ─── Antrenman Girişi ───────────────────────────────────────
    bot.on('message', async (msg) => {
        if (!msg.text || msg.text.startsWith('/')) return;
        const chatId = msg.chat.id;
        const user = await getUserByChatId(chatId);

        if (!user) {
            bot.sendMessage(chatId, '👋 Henüz hesabını bağlamamışsın.\n/start yazarak başla!');
            return;
        }

        const parsed = parseWorkoutMessage(msg.text.trim());
        if (!parsed) {
            bot.sendMessage(chatId,
                `❓ Anlamadım. Şu formatta yaz:\n\`egzersiz ağırlık tekrar\`\n\nÖrnek: \`row 70 2\``,
                { parse_mode: 'Markdown' }
            );
            return;
        }

        const { exerciseName, weight, reps } = parsed;
        const exercise = await findExerciseByAlias(exerciseName);

        if (!exercise) {
            bot.sendMessage(chatId,
                `❌ "${exerciseName}" egzersizi bulunamadı.\n\n/egzersizler komutu ile listeye bak.`,
                { parse_mode: 'Markdown' }
            );
            return;
        }

        const workout = await getOrCreateTodayWorkout(user.id);
        const set = await addSet(workout.id, exercise.id, reps, weight);
        const volumeEmoji = weight * reps >= 500 ? '🔥' : weight * reps >= 200 ? '💪' : '✅';

        bot.sendMessage(chatId,
            `${volumeEmoji} *${exercise.name}*\n` +
            `Set ${set.set_number}: ${weight}kg × ${reps} tekrar\n` +
            `Hacim: ${Math.round(weight * reps)}kg`,
            { parse_mode: 'Markdown' }
        );
    });

}).catch(err => {
    console.error('❌ Veritabanı başlatılamadı:', err);
    process.exit(1);
});

function parseWorkoutMessage(text) {
    let cleaned = text.toLowerCase().replace(/\bkg\b/gi, '').trim();
    const tokens = cleaned.split(/\s+/);
    if (tokens.length < 2) return null;

    const numbers = [];
    const wordTokens = [];

    for (let i = tokens.length - 1; i >= 0; i--) {
        const num = parseFloat(tokens[i]);
        if (!isNaN(num) && numbers.length < 2) {
            numbers.unshift(num);
        } else {
            wordTokens.unshift(...tokens.slice(0, i + 1));
            break;
        }
    }

    if (numbers.length < 2 || wordTokens.length === 0) return null;
    return { exerciseName: wordTokens.join(' '), weight: numbers[0], reps: numbers[1] };
}

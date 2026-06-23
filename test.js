const http = require('http');

function post(path, data) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(data);
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        }, res => {
            let chunks = '';
            res.on('data', c => chunks += c);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(chunks));
                } catch (e) {
                    console.error('Parse error for', path, '- Raw response:', chunks);
                    resolve({});
                }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function get(path) {
    return new Promise((resolve, reject) => {
        http.get('http://localhost:3000' + path, res => {
            let chunks = '';
            res.on('data', c => chunks += c);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(chunks));
                } catch (e) {
                    console.error('Parse error for', path, '- Raw response:', chunks);
                    resolve({});
                }
            });
        }).on('error', reject);
    });
}

async function test() {
    console.log('=== API Test ===\n');

    // Test 1: Kullanıcılar
    const users = await get('/api/users');
    console.log('1. Kullanıcılar:', users.map(u => u.name).join(', '));

    // Test 2: Emirhan row 70kg 2 tekrar
    console.log('\nSending: Emirhan row 70kg 2 tekrar...');
    const set1 = await post('/api/workouts', { user_id: 1, exercise_id: 9, reps: 2, weight_kg: 70 });
    console.log('Response:', JSON.stringify(set1, null, 2));

    // Test 3: Aynı egzersiz tekrar (set 2 olmalı)
    console.log('\nSending: Emirhan row 75kg 3 tekrar...');
    const set2 = await post('/api/workouts', { user_id: 1, exercise_id: 9, reps: 3, weight_kg: 75 });
    console.log('Response:', JSON.stringify(set2, null, 2));

    // Test 4: Alikaan bench press
    console.log('\nSending: Alikaan bench 80kg 5 tekrar...');
    const set3 = await post('/api/workouts', { user_id: 2, exercise_id: 1, reps: 5, weight_kg: 80 });
    console.log('Response:', JSON.stringify(set3, null, 2));

    // Test 5: Bugünkü antrenmanlar
    const today = await get('/api/workouts/today');
    console.log('\n5. Bugünkü antrenmanlar:');
    for (const userId of Object.keys(today)) {
        const data = today[userId];
        console.log('  ', data.user.name + ':', data.sets.length, 'set');
        data.sets.forEach(s => {
            console.log('    -', s.exercise_name, 'Set', s.set_number + ':', s.weight_kg + 'kg x', s.reps);
        });
    }

    // Test 6: Liderlik tablosu
    const leaderboard = await get('/api/leaderboard');
    console.log('\n6. Liderlik tablosu:');
    leaderboard.forEach((e, i) => {
        console.log('  ', (i + 1) + '.', e.name, '-', Math.round(e.total_volume) + 'kg toplam hacim');
    });

    console.log('\n=== Test Tamamlandı ===');
}

test().catch(err => console.error('Test hatası:', err));

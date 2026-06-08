const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { lunchSpots } = require('./lunchSpots');

// --- テスト用定数 ---
const CENTER_LAT = 35.71113;
const CENTER_LNG = 139.79637;
const RADIUS_M = 1000;
const REQUIRED_FIELDS = ['name', 'genre', 'lat', 'lng', 'start', 'end', 'budget'];

// 2点間の距離をメートルで計算
function distanceM(lat1, lng1, lat2, lng2) {
    const dlat = (lat2 - lat1) * 111000;
    const dlng = (lng2 - lng1) * 90000;
    return Math.sqrt(dlat * dlat + dlng * dlng);
}

// --- テスト ---

describe('lunchSpots データ整合性', () => {
    it('1件以上の店舗が存在する', () => {
        assert.ok(lunchSpots.length > 0, 'lunchSpotsが空');
    });

    it('全店舗に必須フィールドが揃っている', () => {
        lunchSpots.forEach((spot, i) => {
            REQUIRED_FIELDS.forEach(field => {
                assert.ok(spot[field] !== undefined && spot[field] !== null && spot[field] !== '',
                    `#${i} "${spot.name || '?'}" に ${field} が不足`);
            });
        });
    });

    it('全店舗のnameが重複していない', () => {
        const names = lunchSpots.map(s => s.name);
        const unique = new Set(names);
        assert.equal(unique.size, names.length, '重複するnameが存在する');
    });

    it('緯度が浅草周辺の妥当な範囲内 (35.69〜35.73)', () => {
        lunchSpots.forEach((spot, i) => {
            assert.ok(spot.lat >= 35.69 && spot.lat <= 35.73,
                `#${i} "${spot.name}" lat=${spot.lat} が範囲外`);
        });
    });

    it('経度が浅草周辺の妥当な範囲内 (139.78〜139.82)', () => {
        lunchSpots.forEach((spot, i) => {
            assert.ok(spot.lng >= 139.78 && spot.lng <= 139.82,
                `#${i} "${spot.name}" lng=${spot.lng} が範囲外`);
        });
    });

    it('全店舗が半径1km圏内にある', () => {
        const outliers = [];
        lunchSpots.forEach((spot, i) => {
            const dist = distanceM(CENTER_LAT, CENTER_LNG, spot.lat, spot.lng);
            if (dist > RADIUS_M) {
                outliers.push(`#${i} "${spot.name}" ${Math.round(dist)}m`);
            }
        });
        assert.equal(outliers.length, 0,
            `半径${RADIUS_M}m圏外: ${outliers.join(', ')}`);
    });

    it('営業開始・終了時刻が HH:MM 形式', () => {
        const timeRe = /^\d{2}:\d{2}$/;
        lunchSpots.forEach((spot, i) => {
            assert.ok(timeRe.test(spot.start),
                `#${i} "${spot.name}" start="${spot.start}" が不正`);
            assert.ok(timeRe.test(spot.end),
                `#${i} "${spot.name}" end="${spot.end}" が不正`);
        });
    });

    it('営業開始 < 営業終了（時刻が逆転していない）', () => {
        lunchSpots.forEach((spot, i) => {
            const [sh, sm] = spot.start.split(':').map(Number);
            const [eh, em] = spot.end.split(':').map(Number);
            const start = sh * 60 + sm;
            const end = eh * 60 + em;
            assert.ok(start < end,
                `#${i} "${spot.name}" start=${spot.start} >= end=${spot.end}`);
        });
    });

    it('予算表記に円マークが含まれている', () => {
        lunchSpots.forEach((spot, i) => {
            assert.ok(spot.budget.includes('¥'),
                `#${i} "${spot.name}" budget="${spot.budget}" に¥なし`);
        });
    });
});

describe('isLunchTime ロジック', () => {
    // テスト用に isLunchTime を再現
    function isLunchTime(startStr, endStr, mockDate) {
        const day = mockDate.getDay();
        if (day === 0 || day === 6) return false;
        const [sHour, sMin] = startStr.split(':').map(Number);
        const [eHour, eMin] = endStr.split(':').map(Number);
        const start = new Date(mockDate).setHours(sHour, sMin, 0);
        const end = new Date(mockDate).setHours(eHour, eMin, 0);
        return mockDate.getTime() >= start && mockDate.getTime() <= end;
    }

    it('平日12時は営業時間内（11:00-14:00）→ true', () => {
        const mon = new Date(2026, 5, 8, 12, 0); // 月曜12時
        assert.equal(isLunchTime('11:00', '14:00', mon), true);
    });

    it('平日10時は営業時間外（11:00-14:00）→ false', () => {
        const mon = new Date(2026, 5, 8, 10, 0);
        assert.equal(isLunchTime('11:00', '14:00', mon), false);
    });

    it('平日15時は営業時間外（11:00-14:00）→ false', () => {
        const mon = new Date(2026, 5, 8, 15, 0);
        assert.equal(isLunchTime('11:00', '14:00', mon), false);
    });

    it('土曜は問わず false', () => {
        const sat = new Date(2026, 5, 13, 12, 0); // 土曜12時
        assert.equal(isLunchTime('11:00', '14:00', sat), false);
    });

    it('日曜は問わず false', () => {
        const sun = new Date(2026, 5, 14, 12, 0); // 日曜12時
        assert.equal(isLunchTime('11:00', '14:00', sun), false);
    });

    it('境界：開始時刻ぴったり → true', () => {
        const mon = new Date(2026, 5, 8, 11, 0);
        assert.equal(isLunchTime('11:00', '14:00', mon), true);
    });

    it('境界：終了時刻ぴったり → true', () => {
        const mon = new Date(2026, 5, 8, 14, 0);
        assert.equal(isLunchTime('11:00', '14:00', mon), true);
    });
});

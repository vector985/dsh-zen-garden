import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defineTool } from '@deepseek-ai/dsh-tools';

/**
 * dsh-zen-garden — 摸鱼植物园。
 *
 * Host half:
 *  - one local JSON garden under $DSH_HOME/zen-garden/state.json
 *    (migrates the old $DSH_HOME/farm/state.json on first load)
 *  - pixel plants grow, drink, make coins while DSH is closed
 *  - 大肥鱼 (snail helper) collects coins and waters thirsty pots
 *  - GET/POST /api/dsh-zen-garden/state for the browser half
 *
 * Client half: ./client (see package.json dsh.client).
 */

export const name = 'dsh-zen-garden';
export const inject = ['connection', 'tools'];

const ROUTE = '/api/dsh-zen-garden/state';
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
const DEFAULT_SAVE_DIR = path.join(DSH_HOME, 'zen-garden');
const LEGACY_SAVE_FILE = path.join(DSH_HOME, 'farm', 'state.json');
const SAVE_DIR = process.env.DSH_FARM_DIR || DEFAULT_SAVE_DIR;
const SAVE_FILE = path.join(SAVE_DIR, 'state.json');
const VERSION = 2;
const POT_COUNT = 8;
const MAX_POT_COINS = 6;
const WATER_MAX = 100;
const WATER_MS = 5 * 60 * 60 * 1000; // 100 water lasts five real hours
const SNAIL_COLLECT_MS = 45_000;
const SNAIL_WATER_MS = 3 * 60_000;
const MAX_LOG = 8;
const WORK_MS_PER_TOKEN = 3; // 1,000 tokens = 3 seconds of plant growth
const WORK_TICK_MS = 8_000;
const WORK_LOG_MAX = 24;
const WORK_BANK_MAX_MS = 10 * 60_000;
const WORK_GAIN_MAX_MS = 10 * 60_000;
const WORK_TOKENS_MAX = 5_000_000;
const WEATHER_TTL = 15 * 60_000;
const WEATHER_RETRY_MS = 5 * 60_000;
const WEATHER_TIMEOUT_MS = 6_000;
const WEATHER_RAIN_DRAIN = 0.35;
const WEATHER_HISTORY_MS = 15 * 60_000;

const PLANTS = {
	sunflower: {
		name: '太阳花',
		emoji: '🌻',
		seedCost: 20,
		sell: 24,
		growMs: 90_000,
		coinMs: 45_000,
		coins: 2,
		xp: 8,
		rarity: '常见',
		color: '#f2c84b',
		blurb: '把阳光攒进花瓣里，笑起来像个小太阳。',
	},
	peashooter: {
		name: '豌豆芽',
		emoji: '🌱',
		seedCost: 25,
		sell: 28,
		growMs: 120_000,
		coinMs: 60_000,
		coins: 3,
		xp: 10,
		rarity: '常见',
		color: '#69c44c',
		blurb: '对着空气练习吐豌豆，准头全靠缘分。',
	},
	wallnut: {
		name: '坚果墩',
		emoji: '🌰',
		seedCost: 40,
		sell: 45,
		growMs: 150_000,
		coinMs: 90_000,
		coins: 4,
		xp: 14,
		rarity: '少见',
		color: '#b97a45',
		blurb: '话不多，但很能扛。兜里总能翻出几枚硬币。',
	},
	cherry: {
		name: '樱桃双弹',
		emoji: '🍒',
		seedCost: 65,
		sell: 70,
		growMs: 210_000,
		coinMs: 120_000,
		coins: 7,
		xp: 20,
		rarity: '稀有',
		color: '#d94b45',
		blurb: '两颗樱桃共用一根脾气不太好的引线。',
	},
	snowpea: {
		name: '冰霜豆',
		emoji: '❄️',
		seedCost: 90,
		sell: 95,
		growMs: 270_000,
		coinMs: 150_000,
		coins: 10,
		xp: 28,
		rarity: '史诗',
		color: '#6cc7e6',
		blurb: '呼出的气能把水珠冻成小冰晶，夏天很抢手。',
	},
	chomper: {
		name: '大嘴花',
		emoji: '🌺',
		seedCost: 120,
		sell: 130,
		growMs: 330_000,
		coinMs: 180_000,
		coins: 14,
		xp: 36,
		rarity: '传说',
		color: '#a95bc7',
		blurb: '看起来想吃人，其实只想吃你手里的硬币。',
	},
};

const PLANT_KEYS = Object.keys(PLANTS);
const WEATHERS = ['晴朗', '微风', '有点晒', '云朵飘过'];

const QUEST_DEFS = [
	{ id: 'water', label: '给植物浇水 3 次', target: 3, reward: 15 },
	{ id: 'collect', label: '收集 20 枚金币', target: 20, reward: 30 },
	{ id: 'plant', label: '种下 1 株新植物', target: 1, reward: 20 },
];

function clampNumber(value, min, max, fallback) {
	const n = Number(value);
	return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function hash(text) {
	let h = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

function dayKey(now) {
	const d = new Date(now);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function weatherFor(day) {
	return WEATHERS[hash(day) % WEATHERS.length];
}

// WMO weather interpretation codes, the vocabulary Open-Meteo returns.
const WMO_WEATHER = {
	0: { label: '晴朗', kind: 'clear', icon: 'sun' },
	1: { label: '大致晴朗', kind: 'clear', icon: 'sun' },
	2: { label: '多云', kind: 'partly', icon: 'cloud-sun' },
	3: { label: '阴天', kind: 'overcast', icon: 'cloud' },
	45: { label: '有雾', kind: 'fog', icon: 'fog' },
	48: { label: '雾凇', kind: 'fog', icon: 'fog' },
	51: { label: '毛毛雨', kind: 'rain', icon: 'rain' },
	53: { label: '细雨', kind: 'rain', icon: 'rain' },
	55: { label: '冻雨', kind: 'rain', icon: 'rain' },
	56: { label: '冻毛毛雨', kind: 'rain', icon: 'rain' },
	57: { label: '冻雨', kind: 'rain', icon: 'rain' },
	61: { label: '小雨', kind: 'rain', icon: 'rain' },
	63: { label: '中雨', kind: 'rain', icon: 'rain' },
	65: { label: '大雨', kind: 'rain', icon: 'rain' },
	66: { label: '冻雨', kind: 'rain', icon: 'rain' },
	67: { label: '强冻雨', kind: 'rain', icon: 'rain' },
	71: { label: '小雪', kind: 'snow', icon: 'snow' },
	73: { label: '中雪', kind: 'snow', icon: 'snow' },
	75: { label: '大雪', kind: 'snow', icon: 'snow' },
	77: { label: '雪粒', kind: 'snow', icon: 'snow' },
	80: { label: '阵雨', kind: 'rain', icon: 'rain' },
	81: { label: '强阵雨', kind: 'rain', icon: 'rain' },
	82: { label: '暴雨', kind: 'rain', icon: 'rain' },
	85: { label: '阵雪', kind: 'snow', icon: 'snow' },
	86: { label: '强阵雪', kind: 'snow', icon: 'snow' },
	95: { label: '雷雨', kind: 'storm', icon: 'storm' },
	96: { label: '雷雨伴冰雹', kind: 'storm', icon: 'storm' },
	99: { label: '强雷雨伴冰雹', kind: 'storm', icon: 'storm' },
};

const TZ_CITIES = {
	'Asia/Shanghai': ['上海', 31.2304, 121.4737],
	'Asia/Chongqing': ['重庆', 29.563, 106.5516],
	'Asia/Harbin': ['哈尔滨', 45.8038, 126.5349],
	'Asia/Hong_Kong': ['香港', 22.3193, 114.1694],
	'Asia/Macau': ['澳门', 22.1987, 113.5439],
	'Asia/Taipei': ['台北', 25.033, 121.5654],
	'Asia/Tokyo': ['东京', 35.6762, 139.6503],
	'Asia/Seoul': ['首尔', 37.5665, 126.978],
	'Asia/Singapore': ['新加坡', 1.3521, 103.8198],
	'Asia/Bangkok': ['曼谷', 13.7563, 100.5018],
	'Europe/London': ['伦敦', 51.5074, -0.1278],
	'Europe/Paris': ['巴黎', 48.8566, 2.3522],
	'Europe/Berlin': ['柏林', 52.52, 13.405],
	'America/New_York': ['纽约', 40.7128, -74.006],
	'America/Chicago': ['芝加哥', 41.8781, -87.6298],
	'America/Denver': ['丹佛', 39.7392, -104.9903],
	'America/Los_Angeles': ['洛杉矶', 34.0522, -118.2437],
	'Australia/Sydney': ['悉尼', -33.8688, 151.2093],
	'Australia/Perth': ['珀斯', -31.9523, 115.8613],
};

const WEATHER_BY_LABEL = {
	晴朗: { kind: 'clear', icon: 'sun' },
	微风: { kind: 'partly', icon: 'cloud-sun' },
	有点晒: { kind: 'clear', icon: 'sun' },
	云朵飘过: { kind: 'partly', icon: 'cloud-sun' },
};

function fallbackWeatherInfo(now, label = weatherFor(dayKey(now))) {
	const look = WEATHER_BY_LABEL[label] || { kind: 'partly', icon: 'cloud-sun' };
	return {
		label,
		code: null,
		temp: null,
		feels: null,
		humidity: null,
		wind: null,
		isDay: true,
		kind: look.kind,
		icon: look.icon,
		city: '',
		latitude: null,
		longitude: null,
		source: 'fallback',
		ok: false,
		updatedAt: 0,
	};
}

function weatherCodeInfo(code) {
	return WMO_WEATHER[code] || { label: '天气未知', kind: 'overcast', icon: 'cloud' };
}

function weatherEffect(info) {
	const kind = info?.kind || 'overcast';
	const effect = { growth: 1, water: 1, coin: 1 };
	if (kind === 'clear') {
		effect.growth = 1.05;
		effect.coin = 1.05;
	} else if (kind === 'rain') {
		effect.growth = 1.15;
		effect.water = WEATHER_RAIN_DRAIN;
	} else if (kind === 'storm') {
		effect.growth = 0.95;
		effect.water = 0.5;
		effect.coin = 0.9;
	} else if (kind === 'snow') {
		effect.growth = 0.72;
		effect.water = 0.8;
		effect.coin = 0.9;
	} else if (kind === 'fog') {
		effect.growth = 0.95;
	}
	return effect;
}

function weatherEffectLabel(info) {
	const kind = info?.kind || 'overcast';
	if (kind === 'rain') return '雨天生长 +15% · 雨水帮忙保水';
	if (kind === 'storm') return '雷雨生长 -5% · 记得收衣服';
	if (kind === 'snow') return '雪天生长 -28% · 花在偷偷冬眠';
	if (kind === 'clear') return '晴天生长 +5% · 适合晒太阳';
	if (kind === 'fog') return '有雾生长 -5% · 慢慢来';
	return '阴天 · 正常生长';
}

function normalizeWeatherInfo(raw, now, fallbackLabel) {
	const fallback = fallbackWeatherInfo(now, fallbackLabel);
	if (!raw || typeof raw !== 'object') return fallback;
	const kind = ['clear', 'partly', 'overcast', 'fog', 'rain', 'snow', 'storm'].includes(raw.kind)
		? raw.kind
		: fallback.kind;
	const icon = ['sun', 'moon', 'cloud-sun', 'cloud', 'rain', 'snow', 'storm', 'fog'].includes(raw.icon)
		? raw.icon
		: fallback.icon;
	return {
		label: typeof raw.label === 'string' && raw.label.trim() ? raw.label.slice(0, 24) : fallback.label,
		code: raw.code === null || raw.code === undefined ? null : Math.floor(clampNumber(raw.code, 0, 99, -1)),
		temp: raw.temp === null || raw.temp === undefined ? null : clampNumber(raw.temp, -80, 60, null),
		feels: raw.feels === null || raw.feels === undefined ? null : clampNumber(raw.feels, -80, 60, null),
		humidity: raw.humidity === null || raw.humidity === undefined ? null : Math.round(clampNumber(raw.humidity, 0, 100, 0)),
		wind: raw.wind === null || raw.wind === undefined ? null : clampNumber(raw.wind, 0, 500, 0),
		isDay: raw.isDay !== false,
		kind,
		icon,
		city: typeof raw.city === 'string' ? raw.city.slice(0, 40) : '',
		latitude: raw.latitude === null || raw.latitude === undefined ? null : clampNumber(raw.latitude, -90, 90, null),
		longitude: raw.longitude === null || raw.longitude === undefined ? null : clampNumber(raw.longitude, -180, 180, null),
		source: ['open-meteo', 'fallback', 'offline'].includes(raw.source) ? raw.source : 'fallback',
		ok: Boolean(raw.ok),
		updatedAt: clampNumber(raw.updatedAt, 0, now, 0),
	};
}

function normalizeLocation(raw) {
	if (!raw || typeof raw !== 'object') return null;
	const latitude = clampNumber(raw.latitude, -90, 90, NaN);
	const longitude = clampNumber(raw.longitude, -180, 180, NaN);
	if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
	return {
		city: typeof raw.city === 'string' && raw.city.trim() ? raw.city.slice(0, 40) : `${latitude.toFixed(1)},${longitude.toFixed(1)}`,
		latitude,
		longitude,
		source: ['env', 'city', 'timezone', 'ip', 'saved'].includes(raw.source) ? raw.source : 'saved',
		updatedAt: clampNumber(raw.updatedAt, 0, Date.now(), 0),
	};
}

function timezoneCity() {
	try {
		const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		const hit = TZ_CITIES[zone];
		if (hit) return { city: hit[0], latitude: hit[1], longitude: hit[2], source: 'timezone' };
	} catch {
		// Intl is best-effort; the IP fallback still works without it.
	}
	return null;
}

function envLocation() {
	const latitude = Number(process.env.DSH_FARM_LAT);
	const longitude = Number(process.env.DSH_FARM_LON);
	if (Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
		return {
			city: (process.env.DSH_FARM_CITY || '自定义位置').slice(0, 40),
			latitude,
			longitude,
			source: 'env',
		};
	}
	return null;
}

async function fetchJson(url) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), WEATHER_TIMEOUT_MS);
	timer.unref?.();
	try {
		const response = await fetch(url, {
			signal: controller.signal,
			headers: { accept: 'application/json', 'user-agent': 'dsh-zen-garden/0.6 (weather)' },
		});
		if (!response.ok) throw new Error(`weather http ${response.status}`);
		return await response.json();
	} finally {
		clearTimeout(timer);
	}
}

async function geocodeCity(city) {
	const params = new URLSearchParams({ name: city, count: '1', language: 'zh', format: 'json' });
	const body = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
	const hit = Array.isArray(body.results) ? body.results[0] : null;
	if (!hit) throw new Error(`找不到城市：${city}`);
	return {
		city: hit.name || city,
		latitude: Number(hit.latitude),
		longitude: Number(hit.longitude),
		source: 'city',
	};
}

async function ipLocation() {
	const body = await fetchJson('https://ipwho.is/');
	if (!body || body.success === false || !Number.isFinite(Number(body.latitude)) || !Number.isFinite(Number(body.longitude))) {
		throw new Error('IP 定位失败');
	}
	return {
		city: body.city || body.region || '附近',
		latitude: Number(body.latitude),
		longitude: Number(body.longitude),
		source: 'ip',
	};
}

async function resolveWeatherLocation(state) {
	const env = envLocation();
	if (env) return env;
	const wantedCity = (process.env.DSH_FARM_CITY || '').trim();
	if (wantedCity) {
		const saved = normalizeLocation(state.location);
		if (saved && saved.source === 'city' && saved.city === wantedCity) return saved;
		return await geocodeCity(wantedCity);
	}
	const saved = normalizeLocation(state.location);
	if (saved && (saved.source === 'city' || saved.source === 'env')) return saved;
	const tz = timezoneCity();
	if (tz) return tz;
	if (saved) return saved;
	return await ipLocation();
}

async function fetchWeatherInfo(location, now) {
	const params = new URLSearchParams({
		latitude: String(location.latitude),
		longitude: String(location.longitude),
		current: 'temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m,relative_humidity_2m',
		timezone: 'auto',
	});
	const body = await fetchJson(`https://api.open-meteo.com/v1/forecast?${params}`);
	const current = body && body.current;
	if (!current || !Number.isFinite(Number(current.weather_code))) throw new Error('天气数据缺失');
	const code = Number(current.weather_code);
	const look = weatherCodeInfo(code);
	const isDay = Number(current.is_day) === 1;
	return {
		label: look.label,
		code,
		temp: Math.round(Number(current.temperature_2m) * 10) / 10,
		feels: Math.round(Number(current.apparent_temperature) * 10) / 10,
		humidity: Math.round(Number(current.relative_humidity_2m)),
		wind: Math.round(Number(current.wind_speed_10m) * 10) / 10,
		isDay,
		kind: look.kind,
		icon: look.kind === 'clear' && !isDay ? 'moon' : look.icon,
		city: location.city,
		latitude: location.latitude,
		longitude: location.longitude,
		source: 'open-meteo',
		ok: true,
		updatedAt: now,
	};
}

async function refreshWeather(state, now, force = false) {
	const current = normalizeWeatherInfo(state.weatherInfo, now, state.weather);
	const retry = current.ok ? WEATHER_TTL : WEATHER_RETRY_MS;
	if (!force && current.updatedAt && now - current.updatedAt < retry) return null;
	try {
		const location = await resolveWeatherLocation(state);
		const info = await fetchWeatherInfo(location, now);
		return { info, location };
	} catch (error) {
		console.error('[dsh-zen-garden] weather refresh failed:', error.message);
		return {
			info: {
				...current,
				ok: false,
				source: 'offline',
				updatedAt: now,
			},
			location: normalizeLocation(state.location),
		};
	}
}

function startWeather(ctx) {
	if (typeof ctx.inject !== 'function') return;
	ctx.inject(['connection'], scope => {
		let busy = false;
		const tick = async () => {
			if (busy) return;
			busy = true;
			try {
				const now = Date.now();
				const result = await refreshWeather(loadState(now), now);
				if (!result) return;
				const fresh = loadState(Date.now());
				fresh.weatherInfo = result.info;
				fresh.weather = result.info.label;
				if (result.location) fresh.location = { ...result.location, updatedAt: now };
				fresh.updatedAt = now;
				saveState(fresh);
			} catch (error) {
				console.error('[dsh-zen-garden] weather tick failed:', error);
			} finally {
				busy = false;
			}
		};
		scope.effect(() => {
			const warm = setTimeout(tick, 1_200);
			const timer = setInterval(tick, WEATHER_TTL);
			warm.unref?.();
			timer.unref?.();
			return () => {
				clearTimeout(warm);
				clearInterval(timer);
			};
		}, 'dsh-zen-garden: live weather');
	});
}

function emptyPot(id, now) {
	return { id, plant: null, plantedAt: 0, growthMs: 0, water: 0, coins: 0, coinMs: 0, lastTickAt: now };
}

function defaultPots(now) {
	const pots = Array.from({ length: POT_COUNT }, (_, i) => emptyPot(i, now));
	// 开局送两盆：一盆正在开花，一盆还是小苗，打开就有事可做。
	pots[0] = {
		id: 0,
		plant: 'sunflower',
		plantedAt: now - 90 * 60_000,
		growthMs: PLANTS.sunflower.growMs,
		water: 84,
		coins: 2,
		coinMs: 0,
		lastTickAt: now,
	};
	pots[1] = {
		id: 1,
		plant: 'peashooter',
		plantedAt: now - 70_000,
		growthMs: Math.round(PLANTS.peashooter.growMs * 0.55),
		water: 62,
		coins: 0,
		coinMs: 0,
		lastTickAt: now,
	};
	return pots;
}

function dailyQuests() {
	return QUEST_DEFS.map(q => ({ id: q.id, progress: 0, claimed: false }));
}

function defaultLog(now) {
	return [
		{ at: now - 90_000, text: '大肥鱼：今天园子里有点晒，记得给花喝水。' },
		{ at: now - 45_000, text: '大肥鱼：我就在旁边，金币掉了我帮你捡。' },
	];
}

function defaultState(now) {
	return {
		v: VERSION,
		createdAt: now,
		updatedAt: now,
		coins: 120,
		xp: 0,
		day: dayKey(now),
		weather: weatherFor(dayKey(now)),
		weatherInfo: fallbackWeatherInfo(now),
		location: null,
		giftDay: null,
		inventory: { sunflower: 1, peashooter: 1, wallnut: 1, cherry: 0, snowpea: 0, chomper: 0 },
		pots: defaultPots(now),
		snail: {
			auto: true,
			lastCollectAt: now,
			lastCareAt: now,
			helped: 0,
			log: defaultLog(now),
		},
		quests: dailyQuests(),
		collection: { sunflower: 1, peashooter: 1 },
		stats: { planted: 0, watered: 0, collected: 0, coins: 0, sold: 0, gifts: 0 },
		work: {
			tokens: 0,
			gainedMs: 0,
			bankMs: 0,
			sessions: {},
			log: [],
			updatedAt: now,
			meter: false,
		},
	};
}

function normalizeState(raw, now) {
	if (!raw || typeof raw !== 'object' || raw.v !== VERSION) {
		const base = defaultState(now);
		if (raw && typeof raw === 'object') {
			base.coins = clampNumber(raw.coins, 0, 9_999_999, base.coins);
			base.xp = clampNumber(raw.xp, 0, 9_999_999, 0);
		}
		return base;
	}
	const base = defaultState(now);
	const state = {
		...base,
		...raw,
		v: VERSION,
		inventory: { ...base.inventory, ...(raw.inventory || {}) },
		snail: { ...base.snail, ...(raw.snail || {}) },
		stats: { ...base.stats, ...(raw.stats || {}) },
		collection: { ...base.collection, ...(raw.collection || {}) },
		work: { ...base.work, ...(raw.work || {}) },
	};
	state.weatherInfo = normalizeWeatherInfo(raw.weatherInfo, now, typeof raw.weather === 'string' ? raw.weather : base.weather);
	state.weather = state.weatherInfo.label;
	state.location = normalizeLocation(raw.location);
	state.coins = clampNumber(state.coins, 0, 9_999_999, 0);
	state.xp = clampNumber(state.xp, 0, 9_999_999, 0);
	for (const key of PLANT_KEYS) state.inventory[key] = Math.floor(clampNumber(state.inventory[key], 0, 99, 0));
	state.pots = Array.from({ length: POT_COUNT }, (_, i) => {
		const rawPot = Array.isArray(raw.pots) ? raw.pots[i] : null;
		const kind = rawPot && PLANTS[rawPot.plant] ? rawPot.plant : null;
		if (!kind) return emptyPot(i, now);
		const def = PLANTS[kind];
		return {
			id: i,
			plant: kind,
			plantedAt: clampNumber(rawPot.plantedAt, 0, now, now),
			growthMs: clampNumber(rawPot.growthMs, 0, def.growMs, 0),
			water: clampNumber(rawPot.water, 0, WATER_MAX, WATER_MAX),
			coins: Math.floor(clampNumber(rawPot.coins, 0, MAX_POT_COINS, 0)),
			coinMs: clampNumber(rawPot.coinMs, 0, def.coinMs, 0),
			lastTickAt: clampNumber(rawPot.lastTickAt, 0, now, now),
		};
	});
	state.quests = QUEST_DEFS.map(def => {
		const old = Array.isArray(raw.quests) ? raw.quests.find(q => q && q.id === def.id) : null;
		return {
			id: def.id,
			progress: Math.floor(clampNumber(old?.progress, 0, def.target, 0)),
			claimed: Boolean(old?.claimed),
		};
	});
	state.snail.auto = state.snail.auto !== false;
	state.snail.lastCollectAt = clampNumber(state.snail.lastCollectAt, 0, now, now);
	state.snail.lastCareAt = clampNumber(state.snail.lastCareAt, 0, now, now);
	if (!state.snail.lastCollectAt) state.snail.lastCollectAt = now;
	if (!state.snail.lastCareAt) state.snail.lastCareAt = now;
	state.snail.helped = Math.floor(clampNumber(state.snail.helped, 0, 999_999, 0));
	if (!Array.isArray(state.snail.log)) state.snail.log = [];
	state.snail.log = state.snail.log.filter(item => item && typeof item.text === 'string').slice(-MAX_LOG);
	state.work.tokens = Math.floor(clampNumber(state.work.tokens, 0, 9_999_999_999, 0));
	state.work.gainedMs = Math.floor(clampNumber(state.work.gainedMs, 0, 9_999_999_999, 0));
	state.work.bankMs = Math.floor(clampNumber(state.work.bankMs, 0, WORK_BANK_MAX_MS, 0));
	state.work.updatedAt = clampNumber(state.work.updatedAt, 0, now, now);
	state.work.meter = Boolean(state.work.meter);
	const sessions = {};
	if (state.work.sessions && typeof state.work.sessions === 'object') {
		for (const [id, value] of Object.entries(state.work.sessions).slice(0, 80)) {
			const tokens = Number(value);
			if (id && Number.isFinite(tokens) && tokens >= 0) sessions[id] = tokens;
		}
	}
	state.work.sessions = sessions;
	state.work.log = (Array.isArray(state.work.log) ? state.work.log : [])
		.filter(item => item && Number.isFinite(Number(item.at)) && Number.isFinite(Number(item.tokens)))
		.slice(-WORK_LOG_MAX)
		.map(item => ({ at: Number(item.at), tokens: Number(item.tokens), ms: Number(item.ms) || 0 }));
	for (const key of Object.keys(state.stats)) state.stats[key] = Math.floor(clampNumber(state.stats[key], 0, 9_999_999, 0));
	return state;
}

function loadState(now) {
	if (fs.existsSync(SAVE_FILE)) {
		try {
			const raw = JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8'));
			const state = normalizeState(raw, now);
			if (ensureDay(state, now)) saveState(state);
			return state;
		} catch {
			return defaultState(now);
		}
	}
	if (!process.env.DSH_FARM_DIR) {
		try {
			const raw = JSON.parse(fs.readFileSync(LEGACY_SAVE_FILE, 'utf8'));
			const state = normalizeState(raw, now);
			saveState(state);
			return state;
		} catch {}
	}
	return defaultState(now);
}

function saveState(state) {
	fs.mkdirSync(SAVE_DIR, { recursive: true });
	const tmp = `${SAVE_FILE}.${process.pid}.tmp`;
	fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
	fs.renameSync(tmp, SAVE_FILE);
}

function addLog(state, text, now) {
	state.snail.log.push({ at: now, text });
	state.snail.log = state.snail.log.slice(-MAX_LOG);
}

function bumpQuest(state, id, amount = 1) {
	const def = QUEST_DEFS.find(q => q.id === id);
	const quest = state.quests.find(q => q.id === id);
	if (!def || !quest || quest.claimed) return;
	quest.progress = Math.min(def.target, quest.progress + amount);
}

function ensureDay(state, now) {
	const today = dayKey(now);
	if (state.day === today) return false;
	state.day = today;
	// Keep a live weather reading across midnight; only the fallback label
	// belongs to the local day.
	if (!state.weatherInfo || !state.weatherInfo.ok) {
		state.weather = weatherFor(today);
		state.weatherInfo = fallbackWeatherInfo(now, state.weather);
	}
	state.quests = dailyQuests();
	return true;
}

function potIndex(potId) {
	const n = Number(potId);
	if (!Number.isInteger(n) || n < 1 || n > POT_COUNT) throw expectedError(`没有 ${potId} 号花盆。`);
	return n - 1;
}

function expectedError(message) {
	const error = new Error(message);
	error.expected = true;
	return error;
}

function stageOf(pot) {
	if (!pot.plant) return 'empty';
	const def = PLANTS[pot.plant];
	const ratio = pot.growthMs / def.growMs;
	if (ratio < 0.32) return 'sprout';
	if (ratio < 0.999) return 'leafy';
	return 'bloom';
}

function growPot(pot, now, weather = null) {
	if (!pot.plant) {
		pot.lastTickAt = now;
		return false;
	}
	const def = PLANTS[pot.plant];
	if (!def) {
		pot.plant = null;
		return true;
	}
	const elapsed = Math.max(0, Math.min(now - (pot.lastTickAt || now), 30 * 86_400_000));
	pot.lastTickAt = now;
	if (elapsed <= 0) return false;

	const effect = weatherEffect(weather);
	const timeUntilDry = ((pot.water / WATER_MAX) * WATER_MS) / Math.max(0.05, effect.water);
	const active = Math.min(elapsed, timeUntilDry);
	if (active > 0) {
		pot.water = Math.max(0, pot.water - (active / WATER_MS) * WATER_MAX * effect.water);
		if (pot.water > 15) {
			const rate = pot.water > 50 ? 1 : 0.6;
			pot.growthMs = Math.min(def.growMs, pot.growthMs + active * rate * effect.growth);
		}
		if (pot.growthMs >= def.growMs && pot.water > 20) {
			pot.coinMs += active * effect.coin;
			while (pot.coinMs >= def.coinMs && pot.coins < MAX_POT_COINS) {
				pot.coinMs -= def.coinMs;
				pot.coins = Math.min(MAX_POT_COINS, pot.coins + def.coins);
			}
			if (pot.coins >= MAX_POT_COINS) pot.coinMs = 0;
		}
	}
	return true;
}

function fmtTokens(n) {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
	return String(Math.floor(n));
}

function applyWorkTokens(state, rawTokens, now) {
	const tokens = Math.floor(clampNumber(rawTokens, 0, WORK_TOKENS_MAX, 0));
	if (tokens <= 0) return 0;
	state.work.tokens = Math.floor(clampNumber(state.work.tokens + tokens, 0, 9_999_999_999, 0));
	state.work.updatedAt = now;
	const baseMs = tokens * WORK_MS_PER_TOKEN;
	let remaining = Math.min(WORK_GAIN_MAX_MS, baseMs + (state.work.bankMs || 0));
	state.work.bankMs = 0;
	const growing = state.pots.filter(pot => pot.plant && PLANTS[pot.plant] && pot.growthMs < PLANTS[pot.plant].growMs && pot.water > 15);
	let allocated = 0;
	if (growing.length > 0) {
		// Fair-share the bonus, then pass the leftovers to plants that still need them.
		let pending = growing;
		while (pending.length > 0 && remaining >= 1) {
			const share = remaining / pending.length;
			let used = 0;
			for (const pot of pending) {
				const def = PLANTS[pot.plant];
				const add = Math.min(def.growMs - pot.growthMs, share);
				pot.growthMs += add;
				used += add;
			}
			allocated += used;
			remaining -= used;
			pending = pending.filter(pot => pot.growthMs < PLANTS[pot.plant].growMs);
			if (used < 1) break;
		}
	}
	state.work.bankMs = Math.min(WORK_BANK_MAX_MS, Math.max(0, remaining));
	state.work.gainedMs = Math.floor(clampNumber(state.work.gainedMs + allocated, 0, 9_999_999_999, 0));
	state.work.log.push({ at: now, tokens, ms: Math.round(allocated) });
	state.work.log = state.work.log.slice(-WORK_LOG_MAX);
	return allocated;
}

function tokenUsageTotal(usage) {
	const totals = usage && typeof usage === 'object' && usage.totals ? usage.totals : usage;
	if (!totals || typeof totals !== 'object') return null;
	const sum = Number(totals.uncachedInputTokens || 0)
		+ Number(totals.outputTokens || 0)
		+ Number(totals.cacheWriteTokens || 0);
	// Cache reads are previously processed context, not new work; counting them
	// would reward long chats simply for resending the same prompt.
	return Number.isFinite(sum) && sum >= 0 ? Math.floor(sum) : null;
}

function syncTokenWork(state, sessions, projections, now) {
	if (!Array.isArray(sessions) || !projections || typeof projections.stateOf !== 'function') {
		return { delta: 0, changed: false };
	}
	const live = {};
	let delta = 0;
	let changed = false;
	for (const session of sessions) {
		let usage;
		try {
			usage = projections.stateOf(session, 'tokenUsage');
		} catch {
			continue;
		}
		const total = tokenUsageTotal(usage);
		const id = session?.id;
		if (!id || total === null) continue;
		live[id] = total;
		const previous = state.work.sessions[id];
		if (previous === undefined) {
			changed = true;
			continue;
		}
		if (total !== previous) changed = true;
		if (total > previous) delta += Math.min(total - previous, WORK_TOKENS_MAX);
	}
	if (JSON.stringify(live) !== JSON.stringify(state.work.sessions)) changed = true;
	state.work.sessions = live;
	state.work.meter = true;
	if (delta > 0) {
		applyWorkTokens(state, delta, now);
		changed = true;
	}
	return { delta, changed };
}

function startWorkMeter(ctx) {
	if (typeof ctx.inject !== 'function') return;
	ctx.inject(['sessions', 'sessionProjections'], scope => {
		const tick = () => {
			try {
				const now = Date.now();
				const state = loadState(now);
				const changedByTime = advanceState(state, now);
				const result = syncTokenWork(state, scope.sessions.list(), scope.sessionProjections, now);
				if (changedByTime || result.changed) saveState(state);
			} catch (error) {
				console.error('[dsh-zen-garden] token meter tick failed:', error);
			}
		};
		scope.effect(() => {
			const warm = setTimeout(tick, 1_500);
			const timer = setInterval(tick, WORK_TICK_MS);
			warm.unref?.();
			timer.unref?.();
			return () => {
				clearTimeout(warm);
				clearInterval(timer);
			};
		}, 'dsh-zen-garden: token nutrients');
	});
}

function advanceState(state, now) {
	let changed = ensureDay(state, now);
	const weather = state.weatherInfo;
	for (const pot of state.pots) {
		if (growPot(pot, now, weather)) changed = true;
	}
	if (snailCare(state, now)) changed = true;
	return changed;
}

function snailCare(state, now) {
	if (!state.snail.auto) return false;
	let changed = false;
	if (now - (state.snail.lastCollectAt || 0) >= SNAIL_COLLECT_MS) {
		state.snail.lastCollectAt = now;
		let total = 0;
		for (const pot of state.pots) {
			if (pot.coins > 0) {
				total += pot.coins;
				pot.coins = 0;
			}
		}
		if (total > 0) {
			state.coins += total;
			state.xp += total;
			state.stats.collected += total;
			state.snail.helped += 1;
			bumpQuest(state, 'collect', total);
			addLog(state, `大肥鱼捡走了 ${total} 枚金币，顺手在围裙上擦了擦。`, now);
			changed = true;
		}
	}
	if (now - (state.snail.lastCareAt || 0) >= SNAIL_WATER_MS) {
		const thirsty = state.pots
			.filter(pot => pot.plant && pot.water < 25)
			.sort((a, b) => a.water - b.water)[0];
		if (thirsty) {
			thirsty.water = WATER_MAX;
			state.snail.lastCareAt = now;
			state.snail.helped += 1;
			bumpQuest(state, 'water', 1);
			addLog(state, `大肥鱼给 ${thirsty.id + 1} 号盆浇了水，水壶比它人还大。`, now);
			changed = true;
		}
	}
	return changed;
}

function levelOf(xp) {
	const level = Math.floor(xp / 50) + 1;
	return { level, levelXp: xp % 50, nextXp: 50 };
}

function fmtRemain(ms) {
	const s = Math.max(0, Math.ceil(ms / 1000));
	if (s < 60) return `${s} 秒`;
	const m = Math.ceil(s / 60);
	if (m < 60) return `${m} 分`;
	return `${Math.ceil(m / 60)} 小时`;
}

function publicPot(pot, now) {
	if (!pot.plant) {
		return { id: pot.id + 1, plant: null, stage: 'empty', water: 0, coins: 0, thirsty: false, wilted: false, progress: 0, remainMs: 0, coinProgress: 0 };
	}
	const def = PLANTS[pot.plant];
	const stage = stageOf(pot);
	return {
		id: pot.id + 1,
		plant: pot.plant,
		name: def.name,
		emoji: def.emoji,
		color: def.color,
		rarity: def.rarity,
		stage,
		water: Math.round(pot.water),
		coins: pot.coins,
		thirsty: pot.water <= 20,
		wilted: pot.water <= 0.5,
		progress: Math.min(1, pot.growthMs / def.growMs),
		remainMs: Math.max(0, def.growMs - pot.growthMs),
		coinProgress: Math.min(1, pot.coinMs / def.coinMs),
		ageMs: now - pot.plantedAt,
	};
}

function publicState(state, now) {
	return {
		v: VERSION,
		coins: state.coins,
		xp: state.xp,
		...levelOf(state.xp),
		weather: state.weather,
		weatherInfo: {
			...state.weatherInfo,
			effect: weatherEffect(state.weatherInfo),
			tip: weatherEffectLabel(state.weatherInfo),
		},
		day: state.day,
		giftReady: state.giftDay !== state.day,
		serverNow: now,
		pots: state.pots.map(pot => publicPot(pot, now)),
		inventory: state.inventory,
		collection: state.collection,
		stats: state.stats,
		catalog: PLANTS,
		quests: QUEST_DEFS.map(def => {
			const q = state.quests.find(item => item.id === def.id);
			return { ...def, progress: q?.progress || 0, claimed: Boolean(q?.claimed) };
		}),
		snail: {
			auto: state.snail.auto,
			helped: state.snail.helped,
			log: state.snail.log.slice(-5).reverse(),
			lastCollectAt: state.snail.lastCollectAt,
		},
		work: {
			tokens: state.work.tokens,
			gainedMs: state.work.gainedMs,
			bankMs: state.work.bankMs,
			sessionCount: Object.keys(state.work.sessions).length,
			recentTokens: state.work.log.filter(item => now - item.at <= 10 * 60_000).reduce((sum, item) => sum + item.tokens, 0),
			msPerToken: WORK_MS_PER_TOKEN,
			meter: state.work.meter,
			updatedAt: state.work.updatedAt,
		},
	};
}

function farmSummary(state, now) {
	const level = levelOf(state.xp);
	const info = state.weatherInfo || fallbackWeatherInfo(now, state.weather);
	const temp = Number.isFinite(info.temp) ? `${info.temp}°C` : '';
	const place = info.city ? ` · ${info.city}` : '';
	const online = info.ok ? '' : '（离线，保留上次天气）';
	const lines = [`${info.label}${temp ? ` ${temp}` : ''}${place}${online} · 🪙 ${state.coins} 硬币 · Lv.${level.level}（${level.levelXp}/${level.nextXp}）`];
	lines.push(`天气影响：${weatherEffectLabel(info)}`);
	const planted = state.pots.filter(pot => pot.plant);
	if (planted.length === 0) lines.push('花盆全是空的，先种一株吧。');
	for (const pot of planted) {
		const def = PLANTS[pot.plant];
		const stage = stageOf(pot);
		const stageLabel = stage === 'sprout' ? '小苗' : stage === 'leafy' ? '长叶' : '开花';
		const bits = [`${pot.id + 1}号盆 ${def.name}（${stageLabel}）`, `水 ${Math.round(pot.water)}%`];
		if (stage !== 'bloom') bits.push(`还需 ${fmtRemain(def.growMs - pot.growthMs)}`);
		if (pot.coins > 0) bits.push(`💰 ${pot.coins} 枚待收`);
		if (pot.water <= 20) bits.push('口渴');
		lines.push(`- ${bits.join(' · ')}`);
	}
	const empty = state.pots.filter(pot => !pot.plant).map(pot => pot.id + 1);
	if (empty.length) lines.push(`空盆：${empty.join('、')} 号`);
	const seeds = PLANT_KEYS.filter(key => state.inventory[key] > 0).map(key => `${PLANTS[key].name}×${state.inventory[key]}`);
	lines.push(`种子：${seeds.length ? seeds.join('、') : '没有种子，去种子铺买一包'}`);
	const quests = QUEST_DEFS.map(def => {
		const q = state.quests.find(item => item.id === def.id);
		return `${def.label} ${q?.claimed ? '已领' : `${q?.progress || 0}/${def.target}`}`;
	});
	lines.push(`今日园艺：${quests.join(' · ')}`);
	lines.push(`大肥鱼：${state.snail.auto ? `托管中，已帮忙 ${state.snail.helped} 次` : '在打盹（托管关闭）'}`);
	lines.push(`工作养分：${fmtTokens(state.work.tokens)} token · 已给花加速 ${fmtRemain(state.work.gainedMs)}${state.work.bankMs > 0 ? ` · 存着 ${fmtRemain(state.work.bankMs)}` : ''}`);
	return lines.join('\n');
}

const ACTIONS = {
	plant(state, body, now) {
		const index = potIndex(body.potId);
		const kind = String(body.plant || '');
		const def = PLANTS[kind];
		if (!def) throw expectedError('不认识这种植物。');
		const pot = state.pots[index];
		if (pot.plant) throw expectedError('这个花盆已经种上了。');
		if ((state.inventory[kind] || 0) < 1) throw expectedError(`没有${def.name}种子了。`);
		state.inventory[kind] -= 1;
		pot.plant = kind;
		pot.plantedAt = now;
		pot.growthMs = 0;
		pot.water = WATER_MAX;
		pot.coins = 0;
		pot.coinMs = 0;
		pot.lastTickAt = now;
		const bank = Math.min(state.work.bankMs || 0, 60_000);
		if (bank > 0) {
			pot.growthMs = Math.min(def.growMs, bank);
			state.work.bankMs = Math.max(0, (state.work.bankMs || 0) - bank);
			state.work.gainedMs += bank;
		}
		state.stats.planted += 1;
		state.collection[kind] = (state.collection[kind] || 0) + 1;
		state.xp += def.xp;
		bumpQuest(state, 'plant', 1);
		addLog(state, `把${def.name}种进了 ${index + 1} 号盆。`, now);
		return `种下了${def.name}，等它慢慢长。`;
	},
	water(state, body, now) {
		const index = potIndex(body.potId);
		const pot = state.pots[index];
		if (!pot.plant) throw expectedError('空盆不用浇水。');
		if (pot.water >= WATER_MAX - 0.5) throw expectedError('它已经喝饱了。');
		pot.water = WATER_MAX;
		pot.lastTickAt = now;
		state.xp += 1;
		state.stats.watered += 1;
		bumpQuest(state, 'water', 1);
		return `给${PLANTS[pot.plant].name}浇透了水。`;
	},
	waterAll(state, body, now) {
		let count = 0;
		for (const pot of state.pots) {
			if (pot.plant && pot.water < WATER_MAX - 0.5) {
				pot.water = WATER_MAX;
				pot.lastTickAt = now;
				count += 1;
			}
		}
		if (count === 0) throw expectedError('每盆都喝饱了，先歇会儿。');
		state.xp += count;
		state.stats.watered += count;
		bumpQuest(state, 'water', count);
		return `给 ${count} 盆植物浇了水。`;
	},
	collect(state, body, now) {
		const index = potIndex(body.potId);
		const pot = state.pots[index];
		if (!pot.plant) throw expectedError('空盆里没有金币。');
		if (pot.coins <= 0) throw expectedError('这盆还没攒出金币。');
		const amount = pot.coins;
		pot.coins = 0;
		state.coins += amount;
		state.xp += amount;
		state.stats.collected += amount;
		bumpQuest(state, 'collect', amount);
		return `收走了 ${amount} 枚金币。`;
	},
	collectAll(state) {
		let total = 0;
		for (const pot of state.pots) {
			total += pot.coins;
			pot.coins = 0;
		}
		if (total === 0) throw expectedError('现在没有可收的金币。');
		state.coins += total;
		state.xp += total;
		state.stats.collected += total;
		bumpQuest(state, 'collect', total);
		return `一口气收了 ${total} 枚金币。`;
	},
	buySeed(state, body) {
		const kind = String(body.plant || '');
		const def = PLANTS[kind];
		if (!def) throw expectedError('不认识这种种子。');
		const qty = Math.floor(clampNumber(body.qty ?? body.count ?? 1, 1, 9, 1));
		const cost = def.seedCost * qty;
		if (state.coins < cost) throw expectedError('硬币不够，先去收点金币。');
		state.coins -= cost;
		state.inventory[kind] = Math.min(99, (state.inventory[kind] || 0) + qty);
		return `买了 ${qty} 包${def.name}种子。`;
	},
	sellPlant(state, body, now) {
		const index = potIndex(body.potId);
		const pot = state.pots[index];
		if (!pot.plant) throw expectedError('空盆里没有植物可卖。');
		const def = PLANTS[pot.plant];
		const price = def.sell + pot.coins;
		state.coins += price;
		state.stats.sold += 1;
		pot.plant = null;
		pot.plantedAt = 0;
		pot.growthMs = 0;
		pot.water = 0;
		pot.coins = 0;
		pot.coinMs = 0;
		addLog(state, `把${def.name}卖给了路过的大肥鱼，换到 ${price} 枚金币。`, now);
		return `卖掉了${def.name}，得到 ${price} 枚金币。`;
	},
	gift(state, body, now) {
		if (state.giftDay === state.day) throw expectedError('今天的补贴已经领过了。');
		const seed = PLANT_KEYS[hash(`${state.day}:gift`) % 3];
		state.giftDay = state.day;
		state.coins += 30;
		state.inventory[seed] = Math.min(99, (state.inventory[seed] || 0) + 1);
		state.stats.gifts += 1;
		state.stats.coins += 30;
		addLog(state, `大肥鱼塞来 30 枚金币和一包${PLANTS[seed].name}种子。`, now);
		return `领到 30 枚金币，还有一包${PLANTS[seed].name}种子。`;
	},
	setSnail(state, body) {
		state.snail.auto = Boolean(body.auto);
		return state.snail.auto ? '大肥鱼开始托管，会帮你捡金币、浇口渴的花。' : '大肥鱼去旁边打盹了。';
	},
	async setCity(state, body, now) {
		const city = String(body.city || '').trim().slice(0, 40);
		if (!city) throw expectedError('先输入一个城市名，比如「上海」。');
		let location;
		try {
			location = await geocodeCity(city);
		} catch {
			throw expectedError(`找不到「${city}」，换个城市名试试。`);
		}
		state.location = { ...location, updatedAt: now };
		state.weatherInfo = { ...state.weatherInfo, updatedAt: 0 };
		const result = await refreshWeather(state, now, true);
		if (result) {
			state.weatherInfo = result.info;
			state.weather = result.info.label;
			if (result.location) state.location = { ...result.location, updatedAt: now };
		}
		return `天气改看 ${state.location.city}，每 15 分钟刷新。`;
	},
	claimQuest(state, body) {
		const def = QUEST_DEFS.find(item => item.id === body.quest);
		const quest = state.quests.find(item => item.id === body.quest);
		if (!def || !quest) throw expectedError('没有这个任务。');
		if (quest.claimed) throw expectedError('这个奖励已经领过了。');
		if (quest.progress < def.target) throw expectedError('还没完成呢。');
		quest.claimed = true;
		state.coins += def.reward;
		state.xp += 10;
		state.stats.coins += def.reward;
		return `领到 ${def.reward} 枚金币。`;
	},
};

async function handleRequest(request) {
	const now = Date.now();

	if (request.method === 'GET') {
		const state = loadState(now);
		if (advanceState(state, now)) saveState(state);
		return json({ ok: true, state: publicState(state, now) });
	}
	if (request.method !== 'POST') return json({ ok: false, error: '只支持 GET/POST。' }, 405);

	let body;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: '请求格式不对。' }, 400);
	}
	if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ ok: false, error: '请求格式不对。' }, 400);
	if (JSON.stringify(body).length > 20_000) return json({ ok: false, error: '请求太大了。' }, 413);

	const action = ACTIONS[body.action];
	if (!action) return json({ ok: false, error: '不认识这个操作。' }, 400);

	// Load after the async body read so a concurrently fired token tick is not overwritten.
	const state = loadState(now);
	let changed = advanceState(state, now);

	try {
		const event = await action(state, body, now);
		state.updatedAt = now;
		saveState(state);
		return json({ ok: true, event, state: publicState(state, now) });
	} catch (error) {
		if (error?.expected) {
			if (changed) saveState(state);
			return json({ ok: false, error: error.message }, 400);
		}
		console.error('[dsh-zen-garden] action failed:', error);
		return json({ ok: false, error: '园子暂时出了点状况，再试一次。' }, 500);
	}
}

function registerFarmTools(ctx) {
	ctx.tools.register(defineTool({
		name: 'garden_status',
		description: '查看「大肥鱼植物园」的实时状态：硬币、等级、花盆里的植物、开花进度、水分、待收金币、种子、每日任务和大肥鱼托管日志。用户提到植物园、种花、浇水、收金币、摸鱼时可用。',
		parameters: {},
		output: farmTextOutput(),
		execute() {
			const now = Date.now();
			const state = loadState(now);
			if (advanceState(state, now)) saveState(state);
			return farmSummary(state, now);
		},
		presentCall: () => ({ card: 'generic', title: '看一眼摸鱼植物园', kind: 'other' }),
	}));

	ctx.tools.register(defineTool({
		name: 'garden_action',
		description: '操作「大肥鱼植物园」：种植物、浇水、收金币、买种子、卖植物、领每日补贴、开关大肥鱼托管、领取每日任务奖励。用户让你照看园子时使用。收金币要求植物已开花并攒出金币。',
		parameters: {
			action: {
				type: 'string',
				required: true,
				enum: ['plant', 'water', 'waterAll', 'collect', 'collectAll', 'buySeed', 'sellPlant', 'gift', 'setSnail', 'claimQuest'],
				description: '要执行的操作。',
			},
			potId: {
				type: 'integer',
				description: '花盆编号，从 1 开始（界面上写着 1–8）；plant/water/collect/sellPlant 需要。',
			},
			plant: {
				type: 'string',
				enum: PLANT_KEYS,
				description: '植物：sunflower/peashooter/wallnut/cherry/snowpea/chomper；plant/buySeed 需要。',
			},
			count: {
				type: 'integer',
				description: '买种子的数量，默认 1，范围 1–9。',
			},
			auto: {
				type: 'boolean',
				description: 'setSnail 时是否开启大肥鱼托管。',
			},
			quest: {
				type: 'string',
				enum: QUEST_DEFS.map(q => q.id),
				description: 'claimQuest 时领取哪个任务奖励：water/collect/plant。',
			},
		},
		output: farmTextOutput(),
		async execute(args) {
			const now = Date.now();
			const state = loadState(now);
			advanceState(state, now);
			const action = ACTIONS[args.action];
			if (!action) throw new Error(`不认识的园子操作：${args.action}`);
			const input = { ...args, qty: args.qty ?? args.count };
			let event;
			try {
				event = await action(state, input, now);
			} catch (error) {
				if (error?.expected) throw new Error(error.message);
				console.error('[dsh-zen-garden] tool action failed:', error);
				throw new Error('园子暂时出了点状况，再试一次。');
			}
			state.updatedAt = now;
			saveState(state);
			return `${event}\n\n${farmSummary(state, now)}`;
		},
		presentCall: args => ({
			card: 'generic',
			title: `照看摸鱼植物园：${args.action}`,
			kind: 'other',
			rawInput: args,
		}),
	}));
}

function json(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
	});
}

function farmTextOutput() {
	return {
		schema: { type: 'string' },
		render: (_args, value) => [{ type: 'text', text: String(value) }],
	};
}

export function apply(ctx) {
	registerFarmTools(ctx);
	startWorkMeter(ctx);
	startWeather(ctx);
	ctx.effect(
		() =>
			ctx.connection.fetch.register({
				path: ROUTE,
				methods: ['GET', 'POST'],
				requestBody: 'buffered',
				fetch: request => handleRequest(request),
			}),
		'dsh-zen-garden: state route',
	);
}

export const internals = {
	PLANTS,
	POT_COUNT,
	QUEST_DEFS,
	defaultState,
	normalizeState,
	loadState,
	saveState,
	advanceState,
	growPot,
	publicState,
	publicPot,
	stageOf,
	levelOf,
	snailCare,
	farmSummary,
	handleRequest,
	ACTIONS,
	applyWorkTokens,
	syncTokenWork,
	fmtTokens,
	weatherCodeInfo,
	weatherEffect,
	weatherEffectLabel,
	fallbackWeatherInfo,
	normalizeWeatherInfo,
	normalizeLocation,
	WEATHER_TTL,
	SAVE_FILE,
	SAVE_DIR,
	MAX_POT_COINS,
};

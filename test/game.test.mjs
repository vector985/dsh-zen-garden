import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-farm-test-'));
process.env.DSH_FARM_DIR = dir;
const {
	internals,
	apply,
} = await import('../lib/index.js');
const {
	PLANTS,
	defaultState,
	stageOf,
	growPot,
	snailCare,
	publicState,
	handleRequest,
	ACTIONS,
	SAVE_FILE,
	applyWorkTokens,
	syncTokenWork,
	weatherCodeInfo,
	weatherEffect,
	normalizeWeatherInfo,
	fallbackWeatherInfo,
} = internals;

function request(method, body) {
	return new Request('http://farm.test/api/dsh-farm/state', {
		method,
		headers: body ? { 'content-type': 'application/json' } : undefined,
		body: body ? JSON.stringify(body) : undefined,
	});
}

const now = Date.now();
const state = defaultState(now);

// 开局：8 个花盆，太阳花已开花，豌豆芽还在长。
assert.equal(state.pots.length, 8);
assert.equal(state.pots[0].plant, 'sunflower');
assert.equal(stageOf(state.pots[0]), 'bloom');
assert.equal(stageOf(state.pots[1]), 'leafy');
assert.equal(state.pots[2].plant, null);
assert.equal(state.water ? undefined : undefined, undefined);
assert.match(state.weather, /晴|风|晒|云/);

// 种植消耗种子，并把空盆变成小苗。
const beforeSeeds = state.inventory.wallnut;
assert.ok(beforeSeeds > 0);
ACTIONS.plant(state, { potId: 3, plant: 'wallnut' }, now);
assert.equal(state.inventory.wallnut, beforeSeeds - 1);
assert.equal(state.pots[2].plant, 'wallnut');
assert.equal(stageOf(state.pots[2]), 'sprout');
assert.equal(state.stats.planted, 1);

// 重复种同一盆会给出可读错误。
assert.throws(() => ACTIONS.plant(state, { potId: 3, plant: 'sunflower' }, now), /已经种上/);

// 浇水补满，满了再浇会提示。
state.pots[2].water = 20;
ACTIONS.water(state, { potId: 3 }, now);
assert.equal(state.pots[2].water, 100);
assert.throws(() => ACTIONS.water(state, { potId: 3 }, now), /喝饱/);

// 生长和产币：给足水，1000ms 后应攒出这个植物一轮的金币。
const coinPot = {
	id: 3,
	plant: 'sunflower',
	plantedAt: now - 200_000,
	growthMs: PLANTS.sunflower.growMs,
	water: 100,
	coins: 0,
	coinMs: PLANTS.sunflower.coinMs - 1000,
	lastTickAt: now - 1000,
};
assert.equal(growPot(coinPot, now), true);
assert.equal(coinPot.coins, PLANTS.sunflower.coins);
assert.ok(coinPot.coinMs < PLANTS.sunflower.coinMs);

// 收金币进钱包，清空花盆。
state.pots[0].coins = 3;
const coinsBefore = state.coins;
ACTIONS.collect(state, { potId: 1 }, now);
assert.equal(state.pots[0].coins, 0);
assert.equal(state.coins, coinsBefore + 3);
assert.throws(() => ACTIONS.collect(state, { potId: 1 }, now), /还没攒出/);

// 买种子扣钱、加库存；钱不够会拒绝。
state.coins = 500;
const peasBefore = state.inventory.peashooter;
ACTIONS.buySeed(state, { plant: 'peashooter', qty: 2 }, now);
assert.equal(state.inventory.peashooter, peasBefore + 2);
assert.equal(state.coins, 500 - PLANTS.peashooter.seedCost * 2);
state.coins = 0;
assert.throws(() => ACTIONS.buySeed(state, { plant: 'cherry', qty: 1 }, now), /硬币不够/);

// 卖植物换钱并腾出花盆。
state.coins = 0;
const sellPotCoins = state.pots[2].coins;
ACTIONS.sellPlant(state, { potId: 3 }, now);
assert.equal(state.pots[2].plant, null);
assert.equal(state.coins, PLANTS.wallnut.sell + sellPotCoins);

// 每日补贴一天一次。
ACTIONS.gift(state, {}, now);
assert.equal(state.giftDay, state.day);
assert.equal(state.stats.gifts, 1);
assert.throws(() => ACTIONS.gift(state, {}, now), /领过/);

// 一键浇水与一键收金币。
state.pots[4].plant = 'sunflower';
state.pots[4].water = 10;
state.pots[4].coins = 2;
ACTIONS.waterAll(state, {}, now);
assert.equal(state.pots[4].water, 100);
ACTIONS.collectAll(state, {}, now);
assert.ok(state.coins >= 2);

// 大肥鱼自动收币。
const snailState = defaultState(now);
snailState.pots[0].coins = 4;
snailState.snail.lastCollectAt = 0;
const snailBefore = snailState.coins;
assert.equal(snailCare(snailState, now), true);
assert.equal(snailState.pots[0].coins, 0);
assert.equal(snailState.coins, snailBefore + 4);

// 每日任务：浇水 3 次后能领奖。
const questState = defaultState(now);
questState.pots[2].plant = 'sunflower';
questState.pots[2].water = 10;
ACTIONS.waterAll(questState, {}, now);
// 再给两个已有植物浇一下，凑到 3 次（已满的会跳过）。
questState.pots[3].plant = 'wallnut';
questState.pots[3].water = 10;
ACTIONS.water(questState, { potId: 4 }, now);
questState.pots[4].plant = 'cherry';
questState.pots[4].water = 10;
ACTIONS.water(questState, { potId: 5 }, now);
assert.equal(questState.quests.find(q => q.id === 'water').progress, 3);
const questCoins = questState.coins;
ACTIONS.claimQuest(questState, { quest: 'water' }, now);
assert.equal(questState.coins, questCoins + 15);
assert.throws(() => ACTIONS.claimQuest(questState, { quest: 'water' }, now), /领过/);

// 公开状态带目录、进度和任务。
const view = publicState(state, now);
assert.ok(view.catalog.sunflower);
assert.equal(view.pots.length, 8);
assert.equal(typeof view.pots[0].progress, 'number');
assert.equal(view.quests.length, 3);
assert.ok(view.serverNow > 0);

// HTTP：GET 与 POST。
fs.rmSync(SAVE_FILE, { force: true });
const getResponse = await handleRequest(request('GET'));
assert.equal(getResponse.status, 200);
const initial = await getResponse.json();
assert.equal(initial.ok, true);
assert.equal(initial.state.pots.length, 8);

const postResponse = await handleRequest(request('POST', { action: 'plant', potId: 4, plant: 'sunflower' }));
const planted = await postResponse.json();
assert.equal(postResponse.status, 200);
assert.equal(planted.ok, true);
assert.equal(planted.state.pots[3].plant, 'sunflower');

const badResponse = await handleRequest(request('POST', { action: 'plant', potId: 999, plant: 'sunflower' }));
assert.equal(badResponse.status, 400);

// Agent 工具：注册两个工具，plotId 从 1 开始，和界面一致。
fs.rmSync(SAVE_FILE, { force: true });
const registered = [];
const toolCtx = {
	tools: { register(tool) { registered.push(tool); } },
	effect(fn) { fn(); },
	connection: { fetch: { register() {} } },
};
apply(toolCtx);
assert.equal(registered.length, 2);
assert.deepEqual(registered.map(tool => tool.name), ['farm_status', 'farm_action']);

const status = await registered[0].execute({}, {});
assert.match(status, /硬币/);
assert.match(status, /大肥鱼/);

const agentPlanted = await registered[1].execute({ action: 'plant', potId: 5, plant: 'wallnut' }, {});
assert.match(agentPlanted, /坚果墩/);
const saved = JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8'));
assert.equal(saved.pots[4].plant, 'wallnut');

let collected = '';
try {
	collected = await registered[1].execute({ action: 'collectAll' }, {});
} catch (error) {
	collected = error.message;
}
assert.match(collected, /金币/);

// Token 工作养分：1,000 token = 3 秒生长，只分给正在长的花。
const workState = defaultState(now);
const growingBefore = workState.pots[1].growthMs;
applyWorkTokens(workState, 10_000, now);
assert.equal(workState.work.tokens, 10_000);
assert.equal(workState.pots[1].growthMs, growingBefore + 30_000);
assert.equal(workState.work.gainedMs, 30_000);

// 没有正在生长的花时先存着，种下新花再兑现（最多先兑现 60 秒）。
const bankState = defaultState(now);
for (const pot of bankState.pots) {
	pot.plant = null;
	pot.plantedAt = 0;
	pot.growthMs = 0;
	pot.water = 0;
}
applyWorkTokens(bankState, 4_000, now);
assert.equal(bankState.work.bankMs, 12_000);
ACTIONS.plant(bankState, { potId: 3, plant: 'wallnut' }, now);
assert.equal(bankState.pots[2].growthMs, 12_000);
assert.equal(bankState.work.bankMs, 0);
assert.equal(bankState.work.gainedMs, 12_000);

// 快开花的盆只吃自己需要的那一段，剩下的存起来，不虚报加速时间。
const nearState = defaultState(now);
for (const pot of nearState.pots) {
	pot.plant = null;
	pot.plantedAt = 0;
	pot.growthMs = 0;
	pot.water = 0;
}
const wallnutDef = PLANTS.wallnut;
Object.assign(nearState.pots[0], {
	plant: 'wallnut', plantedAt: now, growthMs: wallnutDef.growMs - 1_000, water: 80, lastTickAt: now,
});
applyWorkTokens(nearState, 1_000, now);
assert.equal(nearState.pots[0].growthMs, wallnutDef.growMs);
assert.equal(nearState.work.gainedMs, 1_000);
assert.equal(nearState.work.bankMs, 2_000);

// 会话 tokenUsage 的累计值按增量换算，首次见到只记基线，不补历史。
const syncState = defaultState(now);
let total = 1_000;
const sessions = [{ id: 'session-a' }];
const projections = {
	stateOf(_session, key) {
		assert.equal(key, 'tokenUsage');
		return { totals: { uncachedInputTokens: total, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 } };
	},
};
const baseline = syncTokenWork(syncState, sessions, projections, now);
assert.equal(baseline.delta, 0);
assert.equal(syncState.work.sessions['session-a'], 1_000);
const syncBefore = syncState.pots[1].growthMs;
total = 3_000;
const gained = syncTokenWork(syncState, sessions, projections, now);
assert.equal(gained.delta, 2_000);
assert.equal(syncState.pots[1].growthMs, syncBefore + 6_000);

// 会话关闭后从 live 集合移除，不再重复计旧用量。
syncTokenWork(syncState, [], projections, now);
assert.deepEqual(syncState.work.sessions, {});

// 缓存命中是旧上下文的重放，不算新工作。
const cacheState = defaultState(now);
const cacheProjections = {
	stateOf() { return { totals: { uncachedInputTokens: 1_000, cacheReadTokens: 100_000, outputTokens: 500 } }; },
};
syncTokenWork(cacheState, [{ id: 'session-cache' }], cacheProjections, now);
assert.equal(cacheState.work.sessions['session-cache'], 1_500);

// 实时天气：WMO 代码映射为能看懂的标签和天气类型。
assert.equal(weatherCodeInfo(0).label, '晴朗');
assert.equal(weatherCodeInfo(2).kind, 'partly');
assert.equal(weatherCodeInfo(61).kind, 'rain');
assert.equal(weatherCodeInfo(71).kind, 'snow');
assert.equal(weatherCodeInfo(95).kind, 'storm');
assert.equal(weatherCodeInfo(999).label, '天气未知');

// 天气影响：雨天长得快、水掉得慢；雪天慢一点；晴天小加成。
const rainEffect = weatherEffect({ kind: 'rain' });
assert.equal(rainEffect.growth, 1.15);
assert.equal(rainEffect.water, 0.35);
assert.equal(weatherEffect({ kind: 'snow' }).growth, 0.72);
assert.equal(weatherEffect({ kind: 'clear' }).coin, 1.05);

// 雨天 1 秒只掉 0.35 倍的水，生长快 15%；相同花盆对照普通天气。
function weatherPot() {
	return {
		id: 0, plant: 'sunflower', plantedAt: now - 200_000, growthMs: 0,
		water: 100, coins: 0, coinMs: 0, lastTickAt: now - 1_000,
	};
}
const rainy = weatherPot();
const plain = weatherPot();
growPot(rainy, now, { kind: 'rain' });
growPot(plain, now, { kind: 'overcast' });
assert.ok(rainy.water > plain.water);
assert.ok(rainy.growthMs > plain.growthMs);

// 旧存档没有 weatherInfo 时自动补齐；正规化会裁掉越界温度。
const migrated = defaultState(now);
delete migrated.weatherInfo;
const normalized = internals.normalizeState(migrated, now);
assert.ok(normalized.weatherInfo);
assert.equal(typeof normalized.weatherInfo.label, 'string');
const wild = normalizeWeatherInfo({ label: '热', temp: 999, kind: 'clear', isDay: false, ok: true, updatedAt: now }, now, '晴朗');
assert.equal(wild.temp, 60);
assert.equal(wild.isDay, false);

// 公开状态带天气效果和提示，前端据此换天空。
const weatherView = publicState(normalized, now);
assert.ok(weatherView.weatherInfo.tip.length > 0);
assert.ok(weatherView.weatherInfo.effect.growth > 0);

// 离线时保留上次读数，只标记 ok=false，不清空温度。
const left = fallbackWeatherInfo(now, '晴朗');
const offline = normalizeWeatherInfo({ ...left, temp: 18, city: '上海', source: 'open-meteo', ok: false, updatedAt: now }, now, '晴朗');
assert.equal(offline.temp, 18);
assert.equal(offline.city, '上海');
assert.equal(offline.ok, false);

console.log('dsh-farm tests: 44 checks passed');
fs.rmSync(dir, { recursive: true, force: true });

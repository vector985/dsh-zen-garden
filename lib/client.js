window.__ModuleLoader__.load({
	id: 'dsh-farm',
	factory(require) {
		const React = require('react');
		const e = React.createElement;
		const { useCallback, useEffect, useRef, useState } = React;

		const PANEL_ID = 'dsh-farm';
		const NS = 'dsh-farm';
		const API = '/api/dsh-farm/state';
		const PLANT_KEYS = ['sunflower', 'peashooter', 'wallnut', 'cherry', 'snowpea', 'chomper'];

		const PIXEL = {
			k: '#24150d',
			g: '#63c34f',
			G: '#3a8c38',
			y: '#f7cf4a',
			Y: '#d99a2b',
			o: '#ef8b3a',
			r: '#e0524a',
			R: '#a92f2e',
			p: '#b45fd0',
			P: '#7f3f9e',
			b: '#7dd8f5',
			B: '#3a9fc9',
			n: '#c08451',
			N: '#8a562f',
			w: '#fff6d8',
			s: '#8a5a35',
			d: '#5a341c',
			t: '#ffffff',
		};

		const HEADS = {
			sunflower: [
				'..kkkk..',
				'.kyyyyk.',
				'kyykyyyk',
				'kyyyyyyk',
				'kyykyyyk',
				'.kyyyyk.',
				'..kkkk..',
				'........',
			],
			peashooter: [
				'..kkk...',
				'.kgggk..',
				'kgggggk.',
				'kggkwggk',
				'kgggggk.',
				'.kgggk..',
				'..kkk...',
				'........',
			],
			wallnut: [
				'.kkkk...',
				'knnnnk..',
				'knknknk.',
				'knnnnnk.',
				'knnknnk.',
				'knnnnk..',
				'.kkkk...',
				'........',
			],
			cherry: [
				'.kk..kk.',
				'krrkkrrk',
				'krrkkrrk',
				'krrkkrrk',
				'.kk..kk.',
				'..kggk..',
				'...kk...',
				'........',
			],
			snowpea: [
				'..kkk...',
				'.kbbbk..',
				'kbbbbbk.',
				'kbbkwbbk',
				'kbbbbbk.',
				'.kbbbk..',
				'..kkk...',
				'........',
			],
			chomper: [
				'..kkkk..',
				'.kppppk.',
				'kppppppk',
				'kpkkkkpk',
				'kpkwwkpk',
				'kppkkppk',
				'.kppppk.',
				'..kkkk..',
			],
		};

		const CSS = `
.gdp-root {
  --ink: #24150d;
  --ink2: #3a2413;
  --paper: #fff3cf;
  --paper2: #ecd8a5;
  --gold: #ffd34d;
  --gold2: #d79a27;
  --sky: #66cdf5;
  --sky2: #b6ecff;
  --grass: #79c94e;
  --grass2: #4f9a35;
  --water: #5fc6ef;
  --red: #d94b45;
  --purple: #a45cc9;
  height: 100%;
  min-height: 100%;
  overflow: auto;
  color: var(--ink);
  background:
    repeating-linear-gradient(90deg, rgba(255,255,255,.02) 0 2px, transparent 2px 52px),
    linear-gradient(180deg, #2d1c10, #140d08 70%);
  font-family: "SFMono-Regular", "Cascadia Mono", "PingFang SC", "Microsoft YaHei", ui-monospace, monospace;
  image-rendering: pixelated;
}
.gdp-root *, .gdp-root *::before, .gdp-root *::after { box-sizing: border-box; }
.gdp-page { width: min(1180px, 100%); margin: 0 auto; padding: 18px 16px 30px; }
.gdp-root button { font: inherit; color: inherit; }
.gdp-root button:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }

.gdp-hud {
  position: relative; z-index: 4; display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  padding: 9px 14px;
  background: linear-gradient(180deg, #442b17, #27170d);
  border-top: 3px solid #0c0703; border-bottom: 3px solid #0c0703;
  box-shadow: inset 0 0 0 2px #7a4b25;
}
.gdp-brand { display: flex; align-items: center; gap: 10px; min-width: 250px; }
.gdp-logo {
  width: 52px; height: 52px; flex: 0 0 52px; display: grid; place-items: center;
  background: #2f1b0e; border: 3px solid #0b0603;
  box-shadow: inset 0 0 0 2px #8a5a2c, 3px 3px 0 #090503;
}
.gdp-title {
  margin: 0; font-size: clamp(20px, 2.8vw, 28px); line-height: 1;
  letter-spacing: 2px; font-weight: 900; color: #ffe07a;
  text-shadow: 2px 2px 0 #6b3b1a, 4px 4px 0 #2a1508;
}
.gdp-sub { margin: 4px 0 0; font-size: 10px; letter-spacing: .2em; color: #b9d38a; }
.gdp-stats { display: flex; align-items: stretch; gap: 7px; margin-left: auto; flex-wrap: wrap; }
.gdp-stat {
  min-width: 88px; padding: 5px 9px;
  background: #1c1008; border: 2px solid #080402;
  box-shadow: inset 0 0 0 2px #53351d;
}
.gdp-stat-main { display: flex; align-items: center; gap: 5px; }
.gdp-stat b { display: block; font-size: 15px; line-height: 1.1; color: #ffe27a; font-variant-numeric: tabular-nums; }
.gdp-stat span { display: block; margin-top: 2px; font-size: 10px; letter-spacing: .1em; color: #c7a877; }
.gdp-stat.is-work { border-color: #2f4a1d; box-shadow: inset 0 0 0 2px #3f5e26; background: #16210d; }
.gdp-stat.is-work b { color: #d8ef8e; }
.gdp-stat.is-work span { color: #9cb86b; }
.gdp-work-icon { font-size: 14px; color: #ffe066; text-shadow: 1px 1px 0 #6b3b1a; }

.gdp-workbar {
  display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
  margin: 0 0 6px; padding: 4px 7px;
  background: #1a2810; color: #cfe08f;
  border: 2px solid #0a1306; box-shadow: inset 0 0 0 1px #3b5322;
  font-size: 10px; line-height: 1.35;
}
.gdp-workbar b { color: #ffe066; font-size: 11px; }
.gdp-workbar small { margin-left: auto; color: #9db771; font-size: 9px; }
.gdp-workbar em { font-style: normal; color: #f2c84b; }

.gdp-tabs { display: flex; gap: 5px; margin: 16px 0 0; align-items: flex-end; position: relative; z-index: 3; }
.gdp-tab {
  min-width: 104px; padding: 8px 12px 7px; cursor: pointer;
  background: #4b311b; color: #d8b98c; border: 3px solid #0c0703; border-bottom: none;
  box-shadow: inset 0 2px 0 #7d5128; font-size: 13px; font-weight: 800; letter-spacing: .08em;
}
.gdp-tab small { display: inline-block; margin-left: 5px; font-size: 9px; color: #b58b5c; }
.gdp-tab.is-on { background: var(--paper); color: var(--ink); box-shadow: inset 0 2px 0 #fff; transform: translateY(1px); }
.gdp-tab.is-on small { color: #8c6030; }

.gdp-scene {
  position: relative; overflow: hidden;
  border: 3px solid #0c0703; box-shadow: 6px 6px 0 #090503;
  background: var(--paper);
}
.gdp-sky {
  position: relative; min-height: 96px; padding: 0;
  background: linear-gradient(180deg, #4fc4f0 0%, #8fe0ff 62%, #c8f3ff 100%);
  overflow: hidden;
}
.gdp-sky::after {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(0deg, transparent 0 3px, rgba(255,255,255,.06) 3px 4px);
}
.gdp-sun {
  position: absolute; z-index: 3; top: 16px; right: 44px; width: 36px; height: 36px;
  background: #ffe36b; border: 4px solid #f0a824; border-radius: 50%;
  box-shadow: 7px 0 0 #ffe36b, -7px 0 0 #ffe36b, 0 7px 0 #ffe36b, 0 -7px 0 #ffe36b,
              10px 10px 0 rgba(255, 190, 70, .35);
  animation: gdp-sun 5s steps(2, end) infinite;
}
.gdp-stars {
  position: absolute; inset: 0; z-index: 1; pointer-events: none; opacity: .9;
  background-image:
    radial-gradient(circle, rgba(255,248,210,.95) 1px, transparent 1.5px),
    radial-gradient(circle, rgba(222,235,255,.72) 1px, transparent 1.4px);
  background-size: 37px 31px, 53px 41px;
  background-position: 4px 7px, 19px 13px;
}
.gdp-cloud {
  position: absolute; z-index: 2; width: 58px; height: 18px; background: #fff8e7;
  box-shadow: 16px -10px 0 #fff8e7, 34px 0 0 #fff8e7, 46px 6px 0 #fff8e7;
  opacity: .9; animation: gdp-drift 44s linear infinite;
}
.gdp-cloud.c1 { top: 18px; left: 18%; animation-duration: 52s; }
.gdp-cloud.c2 { top: 48px; left: 58%; animation-duration: 38s; animation-delay: -12s; transform: scale(.7); opacity: .72; }
.gdp-cloud.c3 { top: 10px; left: 84%; animation-duration: 66s; animation-delay: -30s; transform: scale(.55); opacity: .6; }
.gdp-sky-note {
  position: absolute; left: 16px; bottom: 9px; z-index: 5; max-width: calc(100% - 32px);
  padding: 2px 6px; background: rgba(36,21,13,.7); color: #fff3cf;
  border: 2px solid rgba(36,21,13,.65); font-size: 9px; letter-spacing: .1em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* Live weather: the sky is allowed to disagree with the office air-conditioning. */
.gdp-sky.is-night { background: linear-gradient(180deg, #152044 0%, #253d70 58%, #45618e 100%); }
.gdp-sky.is-night .gdp-sun {
  background: radial-gradient(circle at 36% 34%, #fffdf0 0 30%, #eee6c4 31% 100%);
  border-color: #bcb28b;
  box-shadow: 6px 0 0 rgba(244,239,210,.55), -6px 0 0 rgba(244,239,210,.55),
              0 6px 0 rgba(244,239,210,.55), 0 -6px 0 rgba(244,239,210,.55),
              10px 10px 0 rgba(210, 220, 255, .12);
}
.gdp-sky.is-night .gdp-cloud { background: #b9c8e4; box-shadow: 16px -10px 0 #b9c8e4, 34px 0 0 #b9c8e4, 46px 6px 0 #b9c8e4; opacity: .55; }
.gdp-sky.is-overcast { background: linear-gradient(180deg, #70879e 0%, #9db1bd 65%, #c7d2d0 100%); }
.gdp-sky.is-rain, .gdp-sky.is-storm { background: linear-gradient(180deg, #3d566d 0%, #60778a 58%, #91a2a8 100%); }
.gdp-sky.is-rain .gdp-cloud, .gdp-sky.is-storm .gdp-cloud { background: #c4d0d7; box-shadow: 16px -10px 0 #c4d0d7, 34px 0 0 #c4d0d7, 46px 6px 0 #c4d0d7; opacity: .85; }
.gdp-sky.is-rain .gdp-sun, .gdp-sky.is-storm .gdp-sun { display: none; }
.gdp-sky.is-snow { background: linear-gradient(180deg, #8da6bd 0%, #c0d1dc 62%, #e9eff0 100%); }
.gdp-sky.is-snow .gdp-cloud { background: #fffdf4; box-shadow: 16px -10px 0 #fffdf4, 34px 0 0 #fffdf4, 46px 6px 0 #fffdf4; opacity: .96; }
.gdp-sky.is-fog { background: linear-gradient(180deg, #aab7b6 0%, #c9d2cd 60%, #e1e5dc 100%); }
.gdp-sky.is-fog .gdp-sun { opacity: .32; }
.gdp-sky.is-storm::before {
  content: ''; position: absolute; inset: 0; z-index: 1; pointer-events: none;
  background: #f7f6de; opacity: 0; animation: gdp-flash 7s steps(1, end) infinite;
}
.gdp-rain {
  position: absolute; inset: -20% -8%; z-index: 1; pointer-events: none; opacity: .48;
  background: repeating-linear-gradient(112deg, transparent 0 15px, rgba(226, 246, 255, .7) 15px 16.5px, transparent 16.5px 31px);
  animation: gdp-rain .62s linear infinite;
}
.gdp-snow {
  position: absolute; inset: -10% 0 0; z-index: 1; pointer-events: none; opacity: .9;
  background-image:
    radial-gradient(circle, #fff 1.4px, transparent 1.8px),
    radial-gradient(circle, #fff 1px, transparent 1.4px);
  background-size: 27px 27px, 19px 19px;
  background-position: 0 0, 11px 13px;
  animation: gdp-snow 10s linear infinite;
}
.gdp-fog {
  position: absolute; inset: 0; z-index: 1; pointer-events: none;
  background: linear-gradient(180deg, rgba(245, 248, 240, .08), rgba(245, 248, 240, .52) 55%, rgba(245, 248, 240, .74));
}
.gdp-weather-tip {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  margin: 0 0 6px; padding: 4px 7px;
  background: #f3e6bf; color: #3a2a16; border: 2px solid #6b4a24;
  box-shadow: inset 0 0 0 1px #fff5d6; font-size: 10px; line-height: 1.35;
}
.gdp-weather-tip b { color: #2b1b0b; }
.gdp-weather-tip small { margin-left: auto; color: #7b6035; font-size: 9px; }
.gdp-weather-change {
  padding: 1px 5px; border: 1px solid #6b4a24; background: #fff5d6; color: #3a2a16;
  font: inherit; font-size: 9px; line-height: 1.4; cursor: pointer; box-shadow: 1px 1px 0 #6b4a24;
}
.gdp-weather-change:hover { background: #ffe9a8; }
.gdp-weather-change:disabled { opacity: .5; cursor: wait; }
.gdp-modal {
  position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; padding: 18px;
  background: rgba(20, 13, 7, .68);
}
.gdp-modal-card {
  width: min(330px, 100%); padding: 14px; background: #f3e6bf; color: #3a2a16;
  border: 4px solid #4b3218; box-shadow: 6px 6px 0 #090503;
}
.gdp-modal-card h3 { margin: 0 0 3px; font-size: 16px; letter-spacing: .04em; }
.gdp-modal-card p { margin: 0 0 10px; font-size: 10px; line-height: 1.5; color: #7b6035; }
.gdp-modal-card input {
  width: 100%; box-sizing: border-box; padding: 7px 8px; background: #fffaf0; color: #2b1b0b;
  border: 2px solid #6b4a24; font: inherit; font-size: 13px; outline: none;
}
.gdp-modal-card input:focus { border-color: #2f7d32; box-shadow: 0 0 0 2px #9ad960; }
.gdp-modal-error { margin: 6px 0 0; color: #a32a1c; font-size: 10px; }
.gdp-modal-actions { display: flex; justify-content: flex-end; gap: 6px; margin-top: 12px; }
.gdp-modal-actions .gdp-btn { min-height: 30px; font-size: 11px; }
.gdp-weather-tip.is-rain { background: #dcecf0; border-color: #41656e; }
.gdp-weather-tip.is-snow { background: #eef4f4; border-color: #6b8492; }
.gdp-weather-tip.is-storm { background: #e1ddea; border-color: #5b4b72; }
.gdp-weather-tip.is-night { background: #dedbe7; border-color: #4c4669; }
.gdp-weather-glyph { font-size: 14px; line-height: 1; }

.gdp-lawn {
  position: relative; padding: 12px 14px 0;
  background: linear-gradient(180deg, #9ad960 0%, #6fbe49 48%, #65b541 100%);
  border-top: 4px solid #467f2b;
}
.gdp-lawn::before {
  content: ''; position: absolute; inset: 0; pointer-events: none; opacity: .35;
  background:
    repeating-linear-gradient(90deg, rgba(255,255,255,.12) 0 1px, transparent 1px 42px),
    repeating-linear-gradient(0deg, rgba(50,120,30,.16) 0 1px, transparent 1px 34px);
}
.gdp-toolbar { position: relative; z-index: 2; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.gdp-btn {
  display: inline-flex; align-items: center; gap: 5px; cursor: pointer;
  padding: 6px 9px; font-size: 11px; font-weight: 800; letter-spacing: .02em;
  background: var(--paper); border: 3px solid var(--ink); box-shadow: 3px 3px 0 #2a160a;
}
.gdp-btn:hover:not(:disabled) { transform: translate(-1px, -1px); box-shadow: 4px 4px 0 #2a160a; }
.gdp-btn:active:not(:disabled) { transform: translate(2px, 2px); box-shadow: 1px 1px 0 #2a160a; }
.gdp-btn:disabled { opacity: .48; cursor: not-allowed; }
.gdp-btn.is-gold { background: var(--gold); }
.gdp-btn.is-dark { background: #3b2614; color: #ffe27a; border-color: #0b0603; box-shadow: 3px 3px 0 #0b0603; }
.gdp-btn.is-helper { margin-left: auto; }

.gdp-seeds {
  position: relative; z-index: 2; display: flex; align-items: center; gap: 5px; flex-wrap: wrap;
  margin: 9px 0 10px; padding: 6px;
  background: rgba(43, 27, 12, .3); border: 2px solid rgba(36, 21, 13, .38);
}
.gdp-seeds-label { padding: 0 4px; font-size: 10px; font-weight: 900; color: #2e1b0d; letter-spacing: .08em; }
.gdp-seed {
  display: inline-flex; align-items: center; gap: 4px; cursor: pointer;
  padding: 2px 5px; background: #efd9a7; border: 2px solid #38200f;
  box-shadow: 2px 2px 0 #2a160a; font-size: 11px; font-weight: 800;
}
.gdp-seed.is-on { background: var(--gold); outline: 2px solid #fff8dc; outline-offset: 1px; }
.gdp-seed:disabled { opacity: .42; cursor: not-allowed; }
.gdp-seed b { font-size: 10px; }
.gdp-seed em { font-style: normal; color: #6f451e; }
.gdp-seed-hint { margin-left: auto; font-size: 9px; color: rgba(36,21,13,.72); }

.gdp-grid { position: relative; z-index: 2; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.gdp-pot {
  position: relative; display: flex; flex-direction: column; align-items: center;
  min-height: 196px; padding: 7px 5px 7px;
  background: rgba(255, 246, 214, .13);
  border: 2px solid rgba(36, 21, 13, .36);
  box-shadow: inset 0 0 0 2px rgba(255,255,255,.13);
  transition: transform .08s steps(1), background .08s steps(1);
}
.gdp-pot:hover { background: rgba(255, 246, 214, .24); border-color: rgba(36,21,13,.7); transform: translateY(-2px); }
.gdp-pot.is-empty { border-style: dashed; background: rgba(255, 246, 214, .08); }
.gdp-pot.is-low { border-color: rgba(160, 43, 32, .55); }
.gdp-plant {
  position: relative; width: 100%; height: 116px; display: flex; align-items: flex-end; justify-content: center;
  margin-bottom: -18px;
}
.gdp-sprite { display: block; filter: drop-shadow(3px 3px 0 rgba(36,21,13,.2)); }
.gdp-plant .gdp-sprite { animation: gdp-bob 3.2s steps(2, end) infinite; }
.gdp-pot.is-wilted .gdp-sprite { animation: none; transform: rotate(5deg); filter: grayscale(.45) drop-shadow(3px 3px 0 rgba(36,21,13,.2)); }
.gdp-coin {
  position: absolute; top: 0; right: 3px; z-index: 3; display: inline-flex; align-items: center; gap: 3px;
  padding: 1px 4px; cursor: pointer; background: var(--gold); border: 2px solid var(--ink);
  box-shadow: 2px 2px 0 var(--ink); font-size: 10px; font-weight: 900;
  animation: gdp-jiggle 1.8s steps(2, end) infinite;
}
.gdp-thirst {
  position: absolute; top: 1px; left: 3px; z-index: 3; display: inline-flex; align-items: center; gap: 2px;
  padding: 1px 4px; background: #dff6ff; border: 2px solid #22627d; font-size: 9px; font-weight: 900; color: #1b566f;
  animation: gdp-blink 1.4s steps(2, end) infinite;
}
.gdp-pot-sprite { position: relative; z-index: 2; margin-top: 0; }
.gdp-pot-name { margin-top: 3px; font-size: 12px; font-weight: 900; letter-spacing: .02em; }
.gdp-pot-meta { min-height: 14px; margin-top: 1px; font-size: 10px; color: #17380d; font-weight: 700; }
.gdp-waterbar { width: 82%; height: 8px; margin-top: 5px; background: #3f2a1b; border: 2px solid var(--ink); }
.gdp-waterbar i { display: block; height: 100%; background: var(--water); transition: width .2s steps(2, end); }
.gdp-waterbar.is-low i { background: var(--red); animation: gdp-blink 1s steps(2, end) infinite; }
.gdp-pot-actions { display: flex; gap: 4px; flex-wrap: wrap; justify-content: center; margin-top: 5px; position: relative; z-index: 3; }
.gdp-mini {
  padding: 2px 5px; cursor: pointer; background: #fff8df; border: 2px solid var(--ink);
  box-shadow: 2px 2px 0 #2a160a; font-size: 10px; font-weight: 900; line-height: 1.35;
}
.gdp-mini:hover:not(:disabled) { background: var(--gold); }
.gdp-mini:disabled { opacity: .4; cursor: not-allowed; }
.gdp-mini.is-sell { background: #f0c6a0; }
.gdp-mini.is-sell:hover:not(:disabled) { background: #e79a62; }
.gdp-plus { font-size: 30px; line-height: 1; color: rgba(36,21,13,.5); margin-bottom: 22px; font-weight: 900; }
.gdp-empty-name { margin-top: 4px; font-size: 12px; font-weight: 900; color: #2b1b0d; }
.gdp-empty-meta { margin-top: 2px; font-size: 10px; color: #3d2813; }

.gdp-fence {
  position: relative; z-index: 1; height: 26px; margin: 13px -14px 0;
  background: repeating-linear-gradient(90deg, #c9955d 0 9px, #9d6a39 9px 13px, #b57d47 13px 20px);
  border-top: 4px solid #5a341c; border-bottom: 4px solid #3f2412;
  box-shadow: inset 0 4px 0 rgba(255,255,255,.13);
}
.gdp-fence::before {
  content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 9px;
  background: repeating-linear-gradient(90deg, #5a341c 0 4px, transparent 4px 34px);
}

.gdp-dock { display: grid; grid-template-columns: 1.25fr 1fr; gap: 10px; margin-top: 12px; }
.gdp-panel {
  padding: 9px 10px; background: var(--paper); border: 3px solid var(--ink); box-shadow: 4px 4px 0 #0c0703;
}
.gdp-panel h3 { margin: 0 0 7px; font-size: 13px; letter-spacing: .06em; }
.gdp-panel h3 small { margin-left: 5px; font-size: 9px; color: #8c6030; }
.gdp-helper-hint { margin-left: auto; font-size: 10px; font-weight: 800; color: #2f1b0d; }
.gdp-helper { display: flex; align-items: center; gap: 8px; }
.gdp-helper-text { min-width: 0; flex: 1; }
.gdp-helper-text b { display: block; font-size: 12px; }
.gdp-helper-text span { display: block; margin-top: 2px; font-size: 9px; color: #6b4b28; }
.gdp-helper-text em { display: block; margin-top: 3px; font-style: normal; font-size: 9px; color: #7c6a48; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gdp-quest { display: grid; grid-template-columns: 1fr auto; gap: 5px 8px; align-items: center; padding: 4px 0; border-top: 2px dashed #cbb080; }
.gdp-quest:first-of-type { border-top: none; }
.gdp-quest-name { font-size: 11px; font-weight: 800; }
.gdp-quest-bar { grid-column: 1; height: 6px; background: #d8c49a; border: 2px solid var(--ink); }
.gdp-quest-bar i { display: block; height: 100%; background: var(--gold2); }
.gdp-quest button { grid-row: 1 / span 2; grid-column: 2; padding: 2px 5px; font-size: 9px; font-weight: 900; background: var(--gold); border: 2px solid var(--ink); box-shadow: 2px 2px 0 #2a160a; cursor: pointer; }
.gdp-quest button:disabled { opacity: .45; cursor: not-allowed; background: #e9dcbe; box-shadow: none; }
.gdp-quest button.is-claimed { opacity: .6; background: #c8d6b5; }

.gdp-sheet { background: var(--paper); padding: 0; }
.gdp-sheet-head {
  display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;
  padding: 12px 16px; background: #5c3a1e; border-bottom: 4px solid #0c0703; color: #ffe07a;
}
.gdp-sheet-head h2 { margin: 0; font-size: 18px; letter-spacing: .08em; text-shadow: 2px 2px 0 #2a1508; }
.gdp-sheet-head p { margin: 3px 0 0; font-size: 10px; color: #d8b98c; }
.gdp-sheet-body { padding: 12px 14px 18px; background: repeating-linear-gradient(0deg, #f9ecc9 0 3px, #f5e4b9 3px 4px); }
.gdp-sheet-foot { display: flex; align-items: center; gap: 10px; justify-content: space-between; margin-top: 10px; padding: 8px 10px; border: 2px dashed #b89458; background: #f0dfb6; }
.gdp-sheet-foot p { margin: 0; color: #5b4326; font-size: 10px; line-height: 1.6; }
.gdp-sheet-note { margin: 10px 0 0; padding: 7px 10px; border: 2px dashed #b89458; background: #f0dfb6; color: #5b4326; font-size: 10px; line-height: 1.6; }
.gdp-shop-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px; }
.gdp-shop-card {
  display: grid; grid-template-columns: 64px 1fr; gap: 7px; align-items: center;
  padding: 7px; background: var(--paper); border: 3px solid var(--ink); box-shadow: 4px 4px 0 rgba(36,21,13,.55);
}
.gdp-shop-card .gdp-sprite { margin: 0 auto; }
.gdp-shop-info b { display: block; font-size: 11px; }
.gdp-shop-info small { display: block; margin-top: 2px; font-size: 8px; color: #7c5a32; }
.gdp-shop-info p { margin: 3px 0 5px; font-size: 9px; line-height: 1.35; color: #5b4326; }
.gdp-rarity { display: inline-block; padding: 0 4px; margin-left: 4px; background: #ead49f; border: 1px solid #9a743d; font-size: 8px; }
.gdp-buy-row { display: flex; gap: 4px; }
.gdp-buy { padding: 2px 5px; font-size: 9px; font-weight: 900; background: var(--gold); border: 2px solid var(--ink); box-shadow: 2px 2px 0 #2a160a; cursor: pointer; }
.gdp-buy:disabled { opacity: .45; cursor: not-allowed; box-shadow: none; }
.gdp-codex-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px; }
.gdp-codex-card {
  display: flex; gap: 8px; align-items: center; padding: 8px; background: var(--paper);
  border: 2px solid #4d3118; box-shadow: 3px 3px 0 rgba(36,21,13,.35);
}
.gdp-codex-card b { display: block; font-size: 11px; }
.gdp-codex-card small { display: block; margin-top: 2px; font-size: 8px; color: #7c5a32; }
.gdp-codex-card p { margin: 4px 0 0; font-size: 8px; line-height: 1.4; color: #5b4326; }
.gdp-codex-count { margin-left: auto; padding: 1px 4px; background: #ead49f; border: 1px solid #9a743d; font-size: 8px; font-weight: 900; }

.gdp-loading { min-height: 60vh; display: grid; place-items: center; color: #ffe07a; font-size: 13px; letter-spacing: .16em; }
.gdp-loading span { display: inline-block; animation: gdp-blink 1s steps(2, end) infinite; }
.gdp-footer { margin: 13px 0 0; font-size: 9px; letter-spacing: .06em; color: #9f7d4c; text-align: center; }
.gdp-toast {
  position: sticky; bottom: 12px; z-index: 20; width: max-content; max-width: 92%;
  margin: 10px auto 0; padding: 6px 10px; background: #2c1a0d; color: #fff3cf;
  border: 2px solid #0b0603; box-shadow: 3px 3px 0 #0b0603; font-size: 10px; font-weight: 700;
}
.gdp-toast.is-error { background: #6e241d; color: #ffe2d8; }

@keyframes gdp-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
@keyframes gdp-jiggle { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
@keyframes gdp-blink { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
@keyframes gdp-sun { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
@keyframes gdp-drift { from { transform: translateX(-90px); } to { transform: translateX(calc(100vw + 90px)); } }
@keyframes gdp-rain { from { transform: translate3d(0, -24px, 0); } to { transform: translate3d(-18px, 24px, 0); } }
@keyframes gdp-snow { from { background-position: 0 0, 11px 13px; } to { background-position: 0 270px, 11px 289px; } }
@keyframes gdp-flash { 0%, 91%, 94%, 100% { opacity: 0; } 92% { opacity: .22; } 93% { opacity: 0; } }

@media (max-width: 860px) {
  .gdp-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .gdp-shop-grid, .gdp-codex-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .gdp-dock { grid-template-columns: 1fr; }
  .gdp-hud { padding: 9px 10px; gap: 9px; }
  .gdp-brand { min-width: 0; flex: 1; }
  .gdp-stats { width: 100%; margin-left: 0; }
  .gdp-stat { flex: 1; min-width: 0; }
  .gdp-seed-hint { display: none; }
  .gdp-title { font-size: 21px; letter-spacing: 1px; }
  .gdp-sky { min-height: 82px; }
  .gdp-cloud.c3 { display: none; }
  .gdp-toolbar { gap: 4px; }
  .gdp-toolbar .gdp-btn { padding: 6px 7px; font-size: 11px; }
  .gdp-sun { right: 42px; top: 12px; width: 34px; height: 34px; }
  .gdp-sky-note { font-size: 8px; max-width: calc(100% - 24px); }
  .gdp-weather-tip { font-size: 9px; }
}
@media (max-width: 480px) {
  .gdp-page { padding: 10px 8px 22px; }
  .gdp-scene { box-shadow: 4px 4px 0 #090503; }
  .gdp-hud { gap: 7px; padding: 7px; }
  .gdp-logo { width: 42px; height: 42px; flex-basis: 42px; }
  .gdp-title { font-size: 17px; letter-spacing: 0; }
  .gdp-sub { font-size: 8px; letter-spacing: .1em; }
  .gdp-stat { padding: 3px 5px; }
  .gdp-stat b { font-size: 12px; }
  .gdp-stat span { font-size: 8px; letter-spacing: 0; line-height: 1.25; }
  .gdp-stat.is-weather span { white-space: normal; }
  .gdp-weather-tip { gap: 4px; padding: 3px 5px; font-size: 9px; }
  .gdp-weather-tip small { margin-left: 0; width: 100%; }
  .gdp-sky { min-height: 78px; }
  .gdp-tabs { margin-top: 12px; gap: 3px; }
  .gdp-tab { min-width: 0; flex: 1; padding: 6px 4px; font-size: 10px; }
  .gdp-tab small { display: block; margin: 2px 0 0; font-size: 8px; }
  .gdp-toolbar { gap: 4px; }
  .gdp-btn { font-size: 9px; padding: 5px 6px; }
  .gdp-btn.is-helper { margin-left: 0; }
  .gdp-grid { gap: 6px; }
  .gdp-pot { min-height: 168px; }
  .gdp-plant { height: 96px; margin-bottom: -14px; }
  .gdp-pot-name { font-size: 9px; }
  .gdp-pot-meta { font-size: 8px; }
  .gdp-mini { font-size: 8px; padding: 1px 3px; }
  .gdp-shop-grid, .gdp-codex-grid { grid-template-columns: 1fr; }
  .gdp-seed { font-size: 9px; padding: 1px 4px; }
  .gdp-seeds-label { display: none; }
  .gdp-sheet-body { padding: 8px; }
}
@media (prefers-reduced-motion: reduce) {
  .gdp-sun, .gdp-cloud, .gdp-plant .gdp-sprite, .gdp-coin, .gdp-thirst, .gdp-loading span,
  .gdp-rain, .gdp-snow, .gdp-sky.is-storm::before { animation: none !important; }
}
`;

		function ensureStyles() {
			let el = document.getElementById('dsh-farm-styles');
			if (!el) {
				el = document.createElement('style');
				el.id = 'dsh-farm-styles';
				document.head.appendChild(el);
			}
			el.textContent = CSS;
		}

		function pixelRects(rows, offsetX, offsetY) {
			const rects = [];
			rows.forEach((row, y) => {
				Array.from(row).forEach((ch, x) => {
					if (ch === '.' || ch === ' ') return;
					rects.push([offsetX + x, offsetY + y, 1, 1, PIXEL[ch] || '#f0f']);
				});
			});
			return rects;
		}

		function PixelPlant({ kind, stage = 'bloom', size = 112 }) {
			const parts = [];
			const stem = [
				[7, 8, 2, 6, PIXEL.g],
				[6, 9, 1, 5, PIXEL.G],
				[9, 9, 1, 5, PIXEL.G],
				[5, 11, 3, 2, PIXEL.g],
				[9, 12, 3, 2, PIXEL.G],
				[4, 12, 1, 1, PIXEL.G],
				[12, 11, 1, 1, PIXEL.G],
			];
			parts.push(...stem);
			if (HEADS[kind]) parts.push(...pixelRects(HEADS[kind], 4, 1));
			return e(
				'svg',
				{
					className: 'gdp-sprite',
					viewBox: '0 0 16 16',
					width: size,
					height: size,
					shapeRendering: 'crispEdges',
					'aria-hidden': 'true',
				},
				parts.map(([x, y, w, h, fill], i) => e('rect', { key: `p${i}`, x, y, width: w, height: h, fill })),
			);
		}

		function PotSprite({ size = 102 }) {
			const rects = [
				[4, 3, 24, 3, '#d98a4f'],
				[3, 6, 26, 3, '#b9643a'],
				[2, 9, 28, 2, '#8a4a2a'],
				[4, 11, 24, 8, '#bf6a3e'],
				[5, 12, 22, 2, '#d98a4f'],
				[6, 19, 20, 2, '#7a3f24'],
				[5, 21, 22, 1, '#5a2d18'],
				[7, 4, 18, 2, '#5a341c'],
			];
			return e(
				'svg',
				{ className: 'gdp-pot-sprite', viewBox: '0 0 32 24', width: size, height: Math.round(size * 0.75), shapeRendering: 'crispEdges', 'aria-hidden': 'true' },
				rects.map(([x, y, w, h, fill], i) => e('rect', { key: `pot${i}`, x, y, width: w, height: h, fill })),
			);
		}

		function PixelCoin({ size = 16 }) {
			const rows = ['..kkkk..', '.kyyyyk.', 'kyykyyyk', 'kyyyyyyk', 'kyykyyyk', '.kyyyyk.', '..kkkk..'];
			const rects = pixelRects(rows, 0, 0);
			return e('svg', { viewBox: '0 0 8 8', width: size, height: size, shapeRendering: 'crispEdges', 'aria-hidden': 'true' },
				rects.map(([x, y, w, h, fill], i) => e('rect', { key: `c${i}`, x, y, width: w, height: h, fill: fill === PIXEL.y ? PIXEL.y : fill })));
		}

		function PixelDrop({ size = 14 }) {
			const rows = ['...kk...', '..kbbk..', '.kbbbbk.', 'kbbbbbbk', 'kbbbbbbk', '.kbbbbk.', '..kkkk..'];
			return e('svg', { viewBox: '0 0 8 8', width: size, height: size, shapeRendering: 'crispEdges', 'aria-hidden': 'true' },
				pixelRects(rows, 0, 0).map(([x, y, w, h, fill], i) => e('rect', { key: `d${i}`, x, y, width: w, height: h, fill })));
		}

		function FishSprite({ size = 52 }) {
			const rows = [
				'................',
				'......kkkk......',
				'....kkbbbbkk....',
				'..kkbbbbbbbbkk..',
				'.kbbbbbbbbbbbbk.',
				'.kbbwkbbbbbbbbk.',
				'.kbbbbbbbbbbbbk.',
				'..kbbbbbbbbbbk..',
				'...kkbbbbbbkk...',
				'.....kkkkkk.....',
			];
			return e('svg', { viewBox: '0 0 16 10', width: size, height: Math.round(size * 0.625), shapeRendering: 'crispEdges', 'aria-hidden': 'true' },
				pixelRects(rows, 0, 0).map(([x, y, w, h, fill], i) => e('rect', { key: `f${i}`, x, y, width: w, height: h, fill })));
		}

		function FarmIcon({ size = 18 }) {
			return e(PixelPlant, { kind: 'sunflower', stage: 'bloom', size });
		}

		function formatTokens(n) {
			if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
			if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
			return String(Math.floor(n || 0));
		}

		function formatRemain(ms) {
			const seconds = Math.max(0, Math.ceil(ms / 1000));
			if (seconds < 60) return `${seconds} 秒`;
			const minutes = Math.ceil(seconds / 60);
			if (minutes < 60) return `${minutes} 分钟`;
			return `${Math.ceil(minutes / 60)} 小时`;
		}

		function severity(pot) {
			return Boolean(pot.plant) && pot.water <= 20;
		}

		function weatherInfoOf(data) {
			const info = data.weatherInfo || {};
			const kind = ['clear', 'partly', 'overcast', 'fog', 'rain', 'snow', 'storm'].includes(info.kind) ? info.kind : 'partly';
			const label = info.label || (typeof data.weather === 'string' ? data.weather : '天气未知');
			return {
				label,
				kind,
				isDay: info.isDay !== false,
				icon: info.icon || (kind === 'clear' ? 'sun' : kind === 'rain' ? 'rain' : 'cloud'),
				temp: Number.isFinite(info.temp) ? Math.round(info.temp) : null,
				city: info.city || '',
				ok: info.ok !== false,
				tip: info.tip || (kind === 'rain' ? '雨天生长 +15% · 雨水帮忙保水' : '天气随窗外变化 · 每 15 分钟更新'),
			};
		}

		function weatherGlyph(weather) {
			if (weather.kind === 'rain') return '☂';
			if (weather.kind === 'snow') return '❄';
			if (weather.kind === 'storm') return '⚡';
			if (weather.kind === 'fog') return '≋';
			if (weather.kind === 'clear') return weather.isDay ? '☀' : '☾';
			return '☁';
		}

		function weatherTitle(weather) {
			const temp = weather.temp !== null ? ` ${weather.temp}°C` : '';
			const city = weather.city ? ` · ${weather.city}` : '';
			return `${weather.label}${temp}${city} · ${weather.ok ? 'Open-Meteo 实时天气，每 15 分钟更新' : '天气离线，显示上次读数'}`;
		}

		function skyClass(weather) {
			return `gdp-sky is-${weather.kind}${weather.isDay ? '' : ' is-night'}`;
		}

		function WeatherSky({ weather }) {
			const rainy = weather.kind === 'rain' || weather.kind === 'storm';
			const starry = !weather.isDay && (weather.kind === 'clear' || weather.kind === 'partly');
			const note = `${weather.temp !== null ? `${weather.temp}°C · ` : ''}${weather.label}${weather.city ? ` · ${weather.city}` : ''}${weather.ok ? '' : ' · 离线'}`;
			return e('div', { className: skyClass(weather) },
				starry ? e('div', { className: 'gdp-stars', 'aria-hidden': 'true' }) : null,
				e('div', { className: 'gdp-sun', 'aria-hidden': 'true' }),
				e('div', { className: 'gdp-cloud c1' }),
				e('div', { className: 'gdp-cloud c2' }),
				weather.kind === 'partly' || weather.kind === 'clear' ? e('div', { className: 'gdp-cloud c3' }) : null,
				rainy ? e('div', { className: 'gdp-rain', 'aria-hidden': 'true' }) : null,
				weather.kind === 'snow' ? e('div', { className: 'gdp-snow', 'aria-hidden': 'true' }) : null,
				weather.kind === 'fog' ? e('div', { className: 'gdp-fog', 'aria-hidden': 'true' }) : null,
				e('span', { className: 'gdp-sky-note' }, note));
		}

		function Stat({ icon, value, label, title, className = '' }) {
			return e('div', { className: `gdp-stat${className ? ` ${className}` : ''}`, title },
				e('div', { className: 'gdp-stat-main' }, icon, e('b', null, value)),
				e('span', null, label));
		}

		function PotCard({ pot, catalog, drift, seed, seedName, busy, onWater, onCollect, onPlant, onSell }) {
			const def = pot.plant ? catalog[pot.plant] : null;
			const remaining = Math.max(0, pot.remainMs - drift);
			const stageLabel = !def ? '' : pot.stage === 'sprout' ? '小苗' : pot.stage === 'leafy' ? '长叶' : '开花';
			const isLow = severity(pot);
			return e('article', { className: `gdp-pot${def ? '' : ' is-empty'}${isLow ? ' is-low' : ''}${pot.wilted ? ' is-wilted' : ''}` },
				e('div', { className: 'gdp-plant' },
					def
						? e(PixelPlant, { kind: pot.plant, stage: pot.stage, size: pot.stage === 'sprout' ? 70 : pot.stage === 'leafy' ? 92 : 112 })
						: e('div', { className: 'gdp-plus', 'aria-hidden': 'true' }, '+'),
					pot.coins > 0
						? e('button', { className: 'gdp-coin', onClick: () => onCollect(pot.id), disabled: Boolean(busy), title: `收 ${pot.coins} 枚金币`, 'aria-label': `收 ${pot.coins} 枚金币` },
							e(PixelCoin, { size: 12 }), pot.coins)
						: null,
					isLow ? e('span', { className: 'gdp-thirst' }, e(PixelDrop, { size: 12 }), '渴') : null),
				e(PotSprite, { size: 94 }),
				def
					? e('div', { className: 'gdp-pot-name' }, `${pot.id}号 · ${def.name}`)
					: e('div', { className: 'gdp-empty-name' }, `${pot.id}号 · 空花盆`),
				def
					? e('div', { className: 'gdp-pot-meta' }, `${stageLabel} · 水 ${pot.water}%${pot.stage === 'bloom' ? '' : ` · ${formatRemain(remaining)}`}`)
					: e('div', { className: 'gdp-empty-meta' }, '点「种下」播种'),
				def ? e('div', { className: `gdp-waterbar${isLow ? ' is-low' : ''}`, title: `水分 ${pot.water}%` }, e('i', { style: { width: `${pot.water}%` } })) : null,
				e('div', { className: 'gdp-pot-actions' },
					def
						? e(React.Fragment, null,
							e('button', { className: 'gdp-mini', onClick: () => onWater(pot.id), disabled: Boolean(busy) || pot.water >= 100, title: '浇水' }, '浇水'),
							e('button', { className: 'gdp-mini', onClick: () => onCollect(pot.id), disabled: Boolean(busy) || pot.coins <= 0, title: '收金币' }, pot.coins > 0 ? `收 ${pot.coins}` : '收币'),
							e('button', { className: 'gdp-mini is-sell', onClick: () => onSell(pot.id, def.sell), disabled: Boolean(busy), title: `卖掉，得 ${def.sell + pot.coins} 金币` }, '卖'))
						: e('button', { className: 'gdp-mini', onClick: () => onPlant(pot.id, seed), disabled: Boolean(busy) || !seed, title: seed ? `种下${seedName}` : '没有种子' }, seed ? `种下·${seedName}` : '没种子')));
		}

		function SeedTray({ inventory, catalog, selected, onSelect }) {
			return e('div', { className: 'gdp-seeds', 'aria-label': '种子袋' },
				e('span', { className: 'gdp-seeds-label' }, '种子袋'),
				PLANT_KEYS.map(key => {
					const count = inventory[key] || 0;
					return e('button', {
						key,
						className: `gdp-seed${selected === key ? ' is-on' : ''}`,
						onClick: () => onSelect(key),
						disabled: count <= 0,
						title: `${catalog[key].name} · ${catalog[key].seedCost} 金币/包`,
					}, e(PixelPlant, { kind: key, stage: 'bloom', size: 20 }), e('b', null, catalog[key].name), e('em', null, `×${count}`));
				}),
				e('span', { className: 'gdp-seed-hint' }, '选一包，再点空花盆'));
		}

		function QuestPanel({ quests, busy, onClaim }) {
			return e('div', { className: 'gdp-panel' },
				e('h3', null, '今日园艺', e('small', null, '每天零点刷新')),
				...quests.map(q => e('div', { className: 'gdp-quest', key: q.id },
					e('span', { className: 'gdp-quest-name' }, q.label),
					e('div', { className: 'gdp-quest-bar' }, e('i', { style: { width: `${Math.min(100, (q.progress / q.target) * 100)}%` } })),
					q.claimed
						? e('button', { className: 'is-claimed', disabled: true }, '已领')
						: q.progress >= q.target
							? e('button', { onClick: () => onClaim(q.id), disabled: Boolean(busy) }, `领 ${q.reward}`)
							: e('button', { disabled: true }, `${q.progress}/${q.target}`))));
		}

		function HelperPanel({ snail, busy, onToggle }) {
			const latest = snail.log && snail.log[0] ? snail.log[0].text : '大肥鱼在园子里转悠。';
			return e('div', { className: 'gdp-panel' },
				e('h3', null, '值班园丁'),
				e('div', { className: 'gdp-helper' },
					e(FishSprite, { size: 48 }),
					e('div', { className: 'gdp-helper-text' },
						e('b', null, '大肥鱼'),
						e('span', null, snail.auto ? `托管中 · 已帮忙 ${snail.helped} 次` : '打盹中 · 托管关闭'),
						e('em', { title: latest }, latest)),
					e('button', { className: 'gdp-mini', onClick: () => onToggle(!snail.auto), disabled: Boolean(busy) }, snail.auto ? '歇会儿' : '叫醒')));
		}

		function CityDialog({ current, busy, onClose, onSubmit }) {
			const [value, setValue] = useState(current || '');
			const [error, setError] = useState('');
			const submit = () => {
				const city = value.trim();
				if (!city) { setError('先写一个城市名。'); return; }
				setError('');
				onSubmit(city);
			};
			return e('div', { className: 'gdp-modal', role: 'presentation', onClick: onClose },
				e('div', {
					className: 'gdp-modal-card',
					role: 'dialog',
					'aria-modal': 'true',
					'aria-label': '设置天气城市',
					onClick: event => event.stopPropagation(),
				},
					e('h3', null, '看哪里的天气？'),
					e('p', null, '输一个城市名，植物园会按那里的实时天气生长。默认跟随本机时区。'),
					e('input', {
						value,
						autoFocus: true,
						maxLength: 40,
						placeholder: '上海 / 杭州 / Tokyo',
						onChange: event => setValue(event.target.value),
						onKeyDown: event => { if (event.key === 'Enter') submit(); },
					}),
					error ? e('p', { className: 'gdp-modal-error' }, error) : null,
					e('div', { className: 'gdp-modal-actions' },
						e('button', { className: 'gdp-btn', onClick: onClose, disabled: Boolean(busy) }, '取消'),
						e('button', { className: 'gdp-btn is-gold', onClick: submit, disabled: Boolean(busy) }, busy === 'setCity' ? '正在查…' : '就这里'))));
		}

		function GardenView({ data, drift, seed, seedName, busy, act, onSelectSeed }) {
			const [cityOpen, setCityOpen] = useState(false);
			const pots = data.pots;
			const planted = pots.filter(pot => pot.plant).length;
			const ready = pots.reduce((sum, pot) => sum + pot.coins, 0);
			const weather = weatherInfoOf(data);
			return e(React.Fragment, null,
				e('section', { className: 'gdp-scene' },
					e(WeatherSky, { weather }),
					e('div', { className: 'gdp-hud' },
						e('div', { className: 'gdp-brand' },
							e('div', { className: 'gdp-logo' }, e(PixelPlant, { kind: 'sunflower', stage: 'bloom', size: 38 })),
							e('div', null,
								e('h1', { className: 'gdp-title' }, '大肥鱼植物园'),
								e('p', { className: 'gdp-sub' }, 'ZEN GARDEN · 工位摸鱼区'))),
						e('div', { className: 'gdp-stats' },
							e(Stat, { icon: e(PixelCoin, { size: 16 }), value: data.coins, label: '金币' }),
							e(Stat, { icon: e('span', { className: 'gdp-level-icon' }, '★'), value: `Lv.${data.level}`, label: `${data.levelXp}/${data.nextXp} 经验` }),
							e(Stat, {
								title: weatherTitle(weather),
								className: 'is-weather',
								icon: e('span', { className: 'gdp-weather-icon' }, weatherGlyph(weather)),
								value: weather.temp !== null ? `${weather.temp}°C` : weather.label,
								label: weather.city ? `${weather.city} · ${weather.label}` : '实时天气',
							}),
							e(Stat, {
								className: 'is-work',
								title: 'agent 每消耗 1,000 token，正在生长的花额外长 3 秒',
								icon: e('span', { className: 'gdp-work-icon' }, '⚡'),
								value: formatTokens(data.work?.tokens || 0),
								label: data.work?.gainedMs ? `工作 +${formatRemain(data.work.gainedMs)}` : '工作养分',
							}))),
					e('div', { className: 'gdp-lawn' },
						e('div', { className: 'gdp-toolbar' },
							e('button', { className: 'gdp-btn', onClick: () => act('waterAll'), disabled: Boolean(busy) }, '浇水壶 · 一键浇水'),
							e('button', { className: 'gdp-btn is-gold', onClick: () => act('collectAll'), disabled: Boolean(busy) || ready === 0 }, `收金币${ready ? ` +${ready}` : ''}`),
							e('button', { className: 'gdp-btn', onClick: () => act('gift'), disabled: Boolean(busy) || !data.giftReady }, data.giftReady ? '领每日补贴' : '补贴已领'),
							e('span', { className: 'gdp-helper-hint' }, `${planted}/8 盆有植物`)),
						e('div', { className: 'gdp-workbar' },
							e('span', null, '⚡ 工作养分'),
							e('b', null, `${formatTokens(data.work?.tokens || 0)} token`),
							e('span', null, data.work?.gainedMs ? `花开加速 +${formatRemain(data.work.gainedMs)}` : '让 agent 干活，花会跟着长'),
							data.work?.bankMs > 0 ? e('em', null, `存着 ${formatRemain(data.work.bankMs)}`) : null,
							e('small', null, '1k token = 3 秒')),
						e('div', { className: `gdp-weather-tip is-${weather.kind}${weather.isDay ? '' : ' is-night'}` },
							e('span', { className: 'gdp-weather-glyph', 'aria-hidden': 'true' }, weatherGlyph(weather)),
							e('b', null, weather.tip),
							e('small', null, weather.ok ? `${weather.city || '附近'} · 实时 · 15 分钟更新` : '天气离线 · 保留上次读数'),
							e('button', { className: 'gdp-weather-change', onClick: () => setCityOpen(true), disabled: Boolean(busy) }, '换城市')),
						e(SeedTray, { inventory: data.inventory, catalog: data.catalog, selected: seed, onSelect: onSelectSeed }),
						e('div', { className: 'gdp-grid' },
							...pots.map(pot => e(PotCard, {
								key: pot.id,
								pot,
								catalog: data.catalog,
								drift,
								seed,
								seedName,
								busy,
								onWater: id => act('water', { potId: id }),
								onCollect: id => act('collect', { potId: id }),
								onPlant: (id, kind) => act('plant', { potId: id, plant: kind }),
								onSell: id => act('sellPlant', { potId: id }),
							}))),
						e('div', { className: 'gdp-fence' })),
					e('div', { className: 'gdp-dock' },
						e(QuestPanel, { quests: data.quests, busy, onClaim: quest => act('claimQuest', { quest }) }),
						e(HelperPanel, { snail: data.snail, busy, onToggle: auto => act('setSnail', { auto }) }))),
				e('p', { className: 'gdp-footer' }, '存档在本机 · 关掉 Harness，花也照长 · 天气跟着窗外 · agent 干得越多，花开得越快'),
				cityOpen ? e(CityDialog, {
					current: weather.city,
					busy,
					onClose: () => setCityOpen(false),
					onSubmit: async city => {
						const ok = await act('setCity', { city });
						if (ok) setCityOpen(false);
					},
				}) : null);
		}

		function ShopView({ data, busy, act, onGarden }) {
			return e('section', { className: 'gdp-scene gdp-sheet' },
				e('div', { className: 'gdp-sheet-head' },
					e('div', null, e('h2', null, '种子铺'), e('p', null, `金币 ${data.coins} · 买一包，种一盆`)),
					e('button', { className: 'gdp-btn is-gold', onClick: () => act('gift'), disabled: Boolean(busy) || !data.giftReady }, data.giftReady ? '领每日补贴 +30' : '补贴已领')),
				e('div', { className: 'gdp-sheet-body' },
					e('div', { className: 'gdp-shop-grid' },
						...PLANT_KEYS.map(key => {
							const def = data.catalog[key];
							const canBuy = data.coins >= def.seedCost;
							return e('div', { className: 'gdp-shop-card', key },
								e(PixelPlant, { kind: key, stage: 'bloom', size: 62 }),
								e('div', { className: 'gdp-shop-info' },
									e('b', null, def.name, e('span', { className: 'gdp-rarity' }, def.rarity)),
									e('small', null, `已有 ${data.inventory[key] || 0} 包 · 卖价 ${def.sell}`),
									e('p', null, def.blurb),
									e('div', { className: 'gdp-buy-row' },
										e('button', { className: 'gdp-buy', disabled: Boolean(busy) || !canBuy, onClick: () => act('buySeed', { plant: key, count: 1 }) }, `${def.seedCost} 买 1`),
										e('button', { className: 'gdp-buy', disabled: Boolean(busy) || data.coins < def.seedCost * 5, onClick: () => act('buySeed', { plant: key, count: 5 }) }, `${def.seedCost * 5} 买 5`))));
						})),
					e('div', { className: 'gdp-sheet-foot' },
						e('p', null, '花园小抄：种子袋选一包 → 回花园点空花盆。开花后自动攒金币，大肥鱼会帮忙收。'),
						e('button', { className: 'gdp-btn is-gold', onClick: onGarden }, '回花园种下'))));
		}

		function CodexView({ data }) {
			return e('section', { className: 'gdp-scene gdp-sheet' },
				e('div', { className: 'gdp-sheet-head' },
					e('div', null, e('h2', null, '植物图鉴'), e('p', null, `已收集 ${Object.values(data.collection).filter(Boolean).length}/6 种 · 每种植物都有一段小脾气`))),
				e('div', { className: 'gdp-sheet-body' },
					e('div', { className: 'gdp-codex-grid' },
						...PLANT_KEYS.map(key => {
							const def = data.catalog[key];
							const seen = data.collection[key] || 0;
							return e('div', { className: 'gdp-codex-card', key },
								e(PixelPlant, { kind: key, stage: 'bloom', size: 58 }),
								e('div', { style: { minWidth: 0 } },
									e('b', null, def.name, e('span', { className: 'gdp-rarity' }, def.rarity)),
									e('small', null, `售价 ${def.sell} · 每 ${Math.round(def.coinMs / 1000)} 秒产 ${def.coins} 金币`),
									e('p', null, def.blurb)),
								e('span', { className: 'gdp-codex-count' }, seen ? `×${seen}` : '未收录'));
						})),
					e('p', { className: 'gdp-sheet-note' }, '图鉴按种下次数累计；卖掉植物不会丢图鉴。稀有植物产币更多，也更娇气。')));
		}

		function GardenPage() {
			const [data, setData] = useState(null);
			const [loadError, setLoadError] = useState('');
			const [tab, setTab] = useState('garden');
			const [seed, setSeed] = useState('sunflower');
			const [busy, setBusy] = useState(null);
			const [toast, setToast] = useState(null);
			const [clock, setClock] = useState(() => Date.now());
			const [loadedAt, setLoadedAt] = useState(() => Date.now());
			const seq = useRef(0);

			const load = useCallback(async () => {
				const id = ++seq.current;
				try {
					const response = await fetch(API, { headers: { accept: 'application/json' } });
					const payload = await response.json().catch(() => ({}));
					if (!response.ok || !payload.ok) throw new Error(payload.error || '园子暂时打不开。');
					if (id !== seq.current) return;
					setData(payload.state);
					setLoadedAt(Date.now());
					setLoadError('');
				} catch (error) {
					if (id === seq.current) setLoadError(error.message || '园子暂时打不开。');
				}
			}, []);

			useEffect(() => { load(); }, [load]);
			useEffect(() => {
				const timer = setInterval(() => setClock(Date.now()), 1000);
				return () => clearInterval(timer);
			}, []);
			useEffect(() => {
				const timer = setInterval(() => { if (!busy) load(); }, 12_000);
				return () => clearInterval(timer);
			}, [busy, load]);
			useEffect(() => {
				if (!toast) return undefined;
				const timer = setTimeout(() => setToast(null), 3200);
				return () => clearTimeout(timer);
			}, [toast]);

			const act = useCallback(async (action, payload = {}) => {
				if (busy) return false;
				setBusy(action);
				try {
					const response = await fetch(API, {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({ action, ...payload }),
					});
					const result = await response.json().catch(() => ({}));
					if (!response.ok || !result.ok) throw new Error(result.error || '操作没成功。');
					setData(result.state);
					setLoadedAt(Date.now());
					setToast({ text: result.event || '好了。', error: false });
					return true;
				} catch (error) {
					setToast({ text: error.message || '操作没成功。', error: true });
					return false;
				} finally {
					setBusy(null);
				}
			}, [busy]);

			if (!data) {
				return e('div', { className: 'gdp-root' },
					e('div', { className: 'gdp-loading' },
						loadError ? `园子打不开：${loadError}` : e('span', null, '正在给花浇水…')));
			}

			const drift = Math.max(0, clock - loadedAt);
			const activeSeed = data.inventory[seed] > 0 ? seed : PLANT_KEYS.find(key => data.inventory[key] > 0) || null;
			const seedName = activeSeed ? data.catalog[activeSeed].name : '';
			const planted = data.pots.filter(pot => pot.plant).length;
			const discovered = Object.values(data.collection).filter(Boolean).length;
			const tabs = [
				['garden', '花园', `${planted}/8`],
				['shop', '种子铺', '6 种'],
				['codex', '图鉴', `${discovered}/6`],
			];
			return e('div', { className: 'gdp-root' },
				e('div', { className: 'gdp-page' },
					e('nav', { className: 'gdp-tabs', 'aria-label': '植物园分区' },
						...tabs.map(([id, label, note]) => e('button', {
							key: id,
							className: `gdp-tab${tab === id ? ' is-on' : ''}`,
							onClick: () => setTab(id),
							'aria-selected': tab === id,
						}, label, e('small', null, note)))),
					tab === 'garden'
						? e(GardenView, {
							data,
							drift,
							seed: activeSeed,
							seedName,
							busy,
							act,
							onSelectSeed: setSeed,
						})
						: null,
					tab === 'shop' ? e(ShopView, { data, busy, act, onGarden: () => setTab('garden') }) : null,
					tab === 'codex' ? e(CodexView, { data }) : null,
					toast ? e('div', { className: `gdp-toast${toast.error ? ' is-error' : ''}`, role: 'status' }, toast.text) : null,
					e('p', { className: 'gdp-footer' }, 'dsh-farm · 纯本地像素植物园')));
		}

		function apply(ctx) {
			ctx.effect(() => { ensureStyles(); }, 'dsh-farm: styles');
			ctx.effect(function* () {
				yield ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, GardenPage));
			}, 'dsh-farm: panel');
			ctx.effect(function* () {
				yield ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
					name: 'sidebar.panellist',
					id: PANEL_ID,
					order: 1,
					label: () => '摸鱼花园',
					locale: NS,
				}, FarmIcon));
			}, 'dsh-farm: sidebar entry');
		}

		return { inject: ['slots'], apply };
	},
});

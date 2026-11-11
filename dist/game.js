(() => {
  'use strict';

  const canvas = document.getElementById('arena');
  const ctx = canvas.getContext('2d', { alpha: false });
  const ui = {
    score: document.getElementById('score'), length: document.getElementById('length'),
    leaders: document.getElementById('leaders'), overlay: document.getElementById('overlay'),
    title: document.getElementById('overlayTitle'), text: document.getElementById('overlayText'),
    primary: document.getElementById('primaryButton'), primaryLabel: document.getElementById('primaryLabel'),
    pause: document.getElementById('pauseButton'), finalStats: document.getElementById('finalStats'),
    finalScore: document.getElementById('finalScore'), bestScore: document.getElementById('bestScore'),
    live: document.getElementById('liveMessage'), joystick: document.getElementById('joystick'),
    knob: document.getElementById('joystickKnob'), boost: document.getElementById('boostButton')
  };
  const WORLD = { w: 3200, h: 2500 };
  const COLORS = [
    { base: '#ff8b1a', light: '#ffd06d', dark: '#dd5c0e', glow: '#ff991c' },
    { base: '#168fee', light: '#63d2ff', dark: '#0968cf', glow: '#38bdff' },
    { base: '#65c84d', light: '#a4e982', dark: '#379942', glow: '#8ee969' },
    { base: '#9845df', light: '#ce8bff', dark: '#6d2dc2', glow: '#ac64ff' },
    { base: '#ed4c9c', light: '#ff91c2', dark: '#bc2577', glow: '#ff6ab8' },
    { base: '#00bdc5', light: '#6cf7e5', dark: '#0a8f9c', glow: '#36eff2' }
  ];
  const ORB_COLORS = ['#ffdd42', '#03dfe9', '#ff80d9', '#bd72f2', '#74e746'];
  const BOT_NAMES = ['Bima', 'Lala', 'Raka', 'Nara', 'Kiko', 'Mika'];
  const keys = new Set();
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist2 = (a, b, c, d) => (a - c) ** 2 + (b - d) ** 2;
  let width = 0, height = 0, dpr = 1;
  let mode = 'menu', player, snakes = [], pellets = [], rocks = [], bushes = [];
  let camera = { x: 0, y: 0 }, lastTime = 0, lastHud = 0;
  let pointerDirection = null, joystickDirection = null, joystickId = null;
  let boostPressed = false, touchSteeringId = null;
  let best = readBest();

  function readBest() {
    try { return Number(localStorage.getItem('ular-neon-best') || 0) || 0; }
    catch { return 0; }
  }
  function saveBest(value) {
    if (value <= best) return;
    best = value;
    try { localStorage.setItem('ular-neon-best', String(best)); } catch { /* Storage is optional. */ }
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }

  function createSnake(name, x, y, angle, color, ai = true, length = 250) {
    const trail = [];
    for (let i = 0; i < length + 32; i += 5) {
      trail.push({ x: x - Math.cos(angle) * i, y: y - Math.sin(angle) * i });
    }
    return { name, x, y, angle, targetAngle: angle, color, ai, length,
      trail, score: ai ? Math.round(rand(190, 860) / 10) * 10 : 0,
      alive: true, respawn: 0, think: 0, target: null, boost: false };
  }

  function randomPoint(margin = 90) {
    return { x: rand(margin, WORLD.w - margin), y: rand(margin, WORLD.h - margin) };
  }
  function spawnPellet(x, y, big = false) {
    const point = x == null ? randomPoint(45) : { x, y };
    pellets.push({ x: point.x, y: point.y, color: Math.floor(rand(0, ORB_COLORS.length)),
      r: big ? 8 : rand(5.5, 8), value: big ? 65 : 25, phase: rand(0, TAU) });
  }
  function makeDecorations() {
    rocks = [
      { x: 1060, y: 640, r: 45 }, { x: 2110, y: 750, r: 53 },
      { x: 900, y: 1530, r: 44 }, { x: 2390, y: 1570, r: 52 },
      { x: 1500, y: 350, r: 38 }, { x: 1740, y: 2000, r: 48 },
      { x: 550, y: 970, r: 40 }, { x: 2710, y: 1130, r: 46 }
    ];
    bushes = [
      { x: 850, y: 410, r: 53 }, { x: 2500, y: 400, r: 70 },
      { x: 700, y: 2030, r: 65 }, { x: 2570, y: 2060, r: 70 },
      { x: 360, y: 1350, r: 48 }, { x: 2890, y: 670, r: 62 },
      { x: 1210, y: 2120, r: 55 }, { x: 2050, y: 250, r: 43 },
      { x: 1010, y: 840, r: 46 }, { x: 2280, y: 1620, r: 59 },
      { x: 1220, y: 1760, r: 52 }
    ];
  }

  function reset() {
    pellets = [];
    makeDecorations();
    for (let i = 0; i < 220; i++) spawnPellet();
    player = createSnake('Kamu', 1600, 1250, -.22, 0, false, 225);
    snakes = [player,
      createSnake('Bima', 1020, 920, 3.5, 1, true, 350),
      createSnake('Lala', 2270, 870, -.4, 3, true, 330),
      createSnake('Raka', 1910, 1800, 1.5, 2, true, 285),
      createSnake('Nara', 960, 1720, 3, 4, true, 270),
      createSnake('Kiko', 2500, 1850, -2.5, 5, true, 280),
      createSnake('Mika', 2150, 400, 2.1, 1, true, 260)
    ];
    camera.x = player.x - width / 2;
    camera.y = player.y - height / 2;
    pointerDirection = null;
    joystickDirection = null;
    boostPressed = false;
    ui.boost.classList.remove('active');
    ui.joystick.classList.remove('active');
    ui.knob.style.transform = 'translate(-50%, -50%)';
    updateHud();
  }

  function showOverlay(kind) {
    mode = kind;
    ui.overlay.classList.remove('hidden');
    ui.pause.disabled = kind !== 'playing' && kind !== 'paused';
    if (kind === 'menu') {
      ui.title.innerHTML = 'Ular <span>Neon</span>';
      ui.text.textContent = 'Makan orb, tumbuh panjang, dan hindari ular lain. Berani jadi yang paling besar?';
      ui.primaryLabel.textContent = 'Mulai Bermain';
      ui.finalStats.hidden = true;
    } else if (kind === 'paused') {
      ui.title.innerHTML = 'Lagi <span>Jeda</span>';
      ui.text.textContent = 'Tarik napas dulu. Arena akan menunggu sampai kamu siap meluncur lagi.';
      ui.primaryLabel.textContent = 'Lanjut Bermain';
      ui.finalStats.hidden = true;
    } else {
      saveBest(player.score);
      ui.title.innerHTML = 'Game <span>Over!</span>';
      ui.text.textContent = 'Ups, ularmu menabrak! Kumpulkan orb lebih banyak dan rebut posisi teratas.';
      ui.primaryLabel.textContent = 'Main Lagi';
      ui.finalStats.hidden = false;
      ui.finalScore.textContent = player.score.toLocaleString('id-ID');
      ui.bestScore.textContent = best.toLocaleString('id-ID');
      ui.live.textContent = `Game over. Skor ${player.score}.`;
    }
  }
  function start() {
    if (mode !== 'paused') reset();
    mode = 'playing';
    ui.overlay.classList.add('hidden');
    ui.pause.disabled = false;
    ui.pause.setAttribute('aria-label', 'Jeda permainan');
    ui.live.textContent = 'Permainan dimulai';
  }
  function pause() {
    if (mode === 'playing') {
      boostPressed = false;
      ui.boost.classList.remove('active');
      showOverlay('paused');
    } else if (mode === 'paused') start();
  }

  function angleDifference(a, b) { return Math.atan2(Math.sin(b - a), Math.cos(b - a)); }
  function controlAngle() {
    let dx = 0, dy = 0;
    if (keys.has('ArrowLeft') || keys.has('a')) dx -= 1;
    if (keys.has('ArrowRight') || keys.has('d')) dx += 1;
    if (keys.has('ArrowUp') || keys.has('w')) dy -= 1;
    if (keys.has('ArrowDown') || keys.has('s')) dy += 1;
    if (dx || dy) return Math.atan2(dy, dx);
    return joystickDirection ?? pointerDirection ?? player.angle;
  }
  function chooseBotTarget(snake) {
    let nearest = null, nearestD = Infinity;
    for (const p of pellets) {
      const d = dist2(snake.x, snake.y, p.x, p.y);
      if (d < nearestD) { nearestD = d; nearest = p; }
    }
    snake.target = nearest || randomPoint();
  }
  function botAngle(snake, dt) {
    snake.think -= dt;
    if (snake.think <= 0 || !snake.target || !pellets.includes(snake.target)) {
      snake.think = rand(.2, .55);
      chooseBotTarget(snake);
    }
    let tx = snake.target.x, ty = snake.target.y;
    if (snake.x < 150) tx = 500;
    if (snake.x > WORLD.w - 150) tx = WORLD.w - 500;
    if (snake.y < 150) ty = 500;
    if (snake.y > WORLD.h - 150) ty = WORLD.h - 500;
    for (const rock of rocks) {
      if (dist2(snake.x, snake.y, rock.x, rock.y) < (rock.r + 100) ** 2) {
        const danger = Math.atan2(rock.y - snake.y, rock.x - snake.x);
        if (Math.abs(angleDifference(snake.angle, danger)) < 1.1) {
          tx = snake.x - (rock.x - snake.x) * 3;
          ty = snake.y - (rock.y - snake.y) * 3;
        }
      }
    }
    return Math.atan2(ty - snake.y, tx - snake.x);
  }

  function updateSnake(snake, dt) {
    if (!snake.alive) {
      snake.respawn -= dt;
      if (snake.ai && snake.respawn <= 0) {
        const point = randomPoint(300);
        Object.assign(snake, createSnake(snake.name, point.x, point.y, rand(-Math.PI, Math.PI), snake.color, true, 230));
      }
      return;
    }
    snake.targetAngle = snake.ai ? botAngle(snake, dt) : controlAngle();
    const turning = clamp(angleDifference(snake.angle, snake.targetAngle), -3.4 * dt, 3.4 * dt);
    snake.angle += turning;
    snake.boost = !snake.ai && boostPressed && snake.length > 155;
    const speed = snake.boost ? 280 : snake.ai ? 135 : 165;
    snake.x += Math.cos(snake.angle) * speed * dt;
    snake.y += Math.sin(snake.angle) * speed * dt;
    if (snake.boost) {
      snake.length -= 22 * dt;
      if (Math.random() < dt * 8) spawnPellet(snake.x - Math.cos(snake.angle) * snake.length * .7 + rand(-8, 8), snake.y - Math.sin(snake.angle) * snake.length * .7 + rand(-8, 8));
    }
    snake.trail.unshift({ x: snake.x, y: snake.y });
    // Keep just enough trail for the visible body.
    let carried = 0, end = snake.trail.length;
    for (let i = 1; i < snake.trail.length; i++) {
      carried += Math.hypot(snake.trail[i].x - snake.trail[i - 1].x, snake.trail[i].y - snake.trail[i - 1].y);
      if (carried > snake.length + 20) { end = i + 1; break; }
    }
    snake.trail.length = end;
    if (snake.x < 22 || snake.y < 22 || snake.x > WORLD.w - 22 || snake.y > WORLD.h - 22) { kill(snake); return; }
    for (const rock of rocks) {
      if (dist2(snake.x, snake.y, rock.x, rock.y) < (rock.r + 10) ** 2) { kill(snake); return; }
    }
    for (let i = pellets.length - 1; i >= 0; i--) {
      const p = pellets[i];
      if (dist2(snake.x, snake.y, p.x, p.y) < (p.r + 19) ** 2) {
        snake.score += p.value;
        snake.length = Math.min(1050, snake.length + (p.value === 65 ? 27 : 12));
        pellets.splice(i, 1);
        spawnPellet();
        if (!snake.ai && snake.score % 250 === 0) ui.live.textContent = `Skor ${snake.score}`;
      }
    }
  }

  function kill(snake) {
    if (!snake.alive) return;
    snake.alive = false;
    snake.respawn = 3.5;
    for (let i = 0; i < snake.trail.length; i += 9) {
      const p = snake.trail[i];
      if (pellets.length < 360) spawnPellet(p.x + rand(-13, 13), p.y + rand(-13, 13), true);
    }
    if (!snake.ai) showOverlay('dead');
  }
  function checkCollisions() {
    for (const snake of snakes) {
      if (!snake.alive) continue;
      for (const other of snakes) {
        if (!other.alive) continue;
        const skip = other === snake ? 26 : 5;
        for (let i = skip; i < other.trail.length; i += 3) {
          const p = other.trail[i];
          if (dist2(snake.x, snake.y, p.x, p.y) < 22 ** 2) {
            kill(snake); break;
          }
        }
        if (!snake.alive) break;
      }
    }
  }

  function updateHud() {
    ui.score.textContent = player.score.toLocaleString('id-ID');
    ui.length.textContent = Math.round(player.length).toLocaleString('id-ID');
    const list = snakes.filter(s => s.alive || s === player).sort((a, b) => b.score - a.score);
    let shown = list.slice(0, 5);
    if (!shown.includes(player)) shown = [...list.slice(0, 4), player];
    ui.leaders.innerHTML = shown.map(snake =>
      `<li class="${snake === player ? 'me' : ''}"><span class="rank">${list.indexOf(snake) === 0 ? '♛' : list.indexOf(snake) + 1}</span><span class="name">${snake.name}</span><span class="points">${snake.score.toLocaleString('id-ID')}</span></li>`
    ).join('');
  }

  function drawGrid() {
    ctx.fillStyle = '#101d3c';
    ctx.fillRect(0, 0, width, height);
    const startX = Math.floor(camera.x / 88) * 88;
    const startY = Math.floor(camera.y / 88) * 88;
    ctx.strokeStyle = 'rgba(40,83,146,.31)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = startX; x < camera.x + width + 88; x += 88) {
      const sx = Math.round(x - camera.x) + .5;
      ctx.moveTo(sx, 0); ctx.lineTo(sx, height);
    }
    for (let y = startY; y < camera.y + height + 88; y += 88) {
      const sy = Math.round(y - camera.y) + .5;
      ctx.moveTo(0, sy); ctx.lineTo(width, sy);
    }
    ctx.stroke();
    const bx = -camera.x, by = -camera.y;
    ctx.strokeStyle = '#79a8dc'; ctx.lineWidth = 8; ctx.shadowColor = '#4bb7ff'; ctx.shadowBlur = 23;
    ctx.strokeRect(bx, by, WORLD.w, WORLD.h);
    ctx.shadowBlur = 0;
  }
  function inView(x, y, margin = 100) {
    return x > camera.x - margin && x < camera.x + width + margin && y > camera.y - margin && y < camera.y + height + margin;
  }
  function drawBush(b) {
    if (!inView(b.x, b.y, b.r + 60)) return;
    ctx.save(); ctx.translate(b.x, b.y);
    const circles = [[-36, 13, .62], [-17, -15, .68], [16, -23, .66], [43, 2, .57], [2, 18, .72], [56, 24, .48], [-53, 30, .49]];
    circles.forEach(([x, y, s], i) => {
      ctx.fillStyle = i < 4 ? '#57b749' : '#07836f';
      ctx.beginPath(); ctx.arc(x * b.r / 65, y * b.r / 65, b.r * s, 0, TAU); ctx.fill();
    });
    ctx.fillStyle = 'rgba(156,242,96,.17)';
    ctx.beginPath(); ctx.ellipse(-b.r * .36, -b.r * .45, b.r * .35, b.r * .17, -.4, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function drawRock(r) {
    if (!inView(r.x, r.y, r.r + 30)) return;
    ctx.save(); ctx.translate(r.x, r.y);
    ctx.fillStyle = 'rgba(0,0,0,.23)'; ctx.beginPath(); ctx.ellipse(8, r.r * .75, r.r * .95, r.r * .25, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#6e7198';
    ctx.beginPath(); ctx.moveTo(-r.r, r.r * .47); ctx.lineTo(-r.r * .82, -r.r * .23); ctx.quadraticCurveTo(-r.r * .4, -r.r * 1.08, r.r * .12, -r.r * .92); ctx.lineTo(r.r * .72, -r.r * .48); ctx.lineTo(r.r, r.r * .36); ctx.quadraticCurveTo(0, r.r * .8, -r.r, r.r * .47); ctx.fill();
    ctx.fillStyle = '#8587a9'; ctx.beginPath(); ctx.moveTo(-r.r * .8, -r.r * .23); ctx.quadraticCurveTo(-r.r * .3, -r.r * .97, r.r * .12, -r.r * .92); ctx.lineTo(r.r * .5, -r.r * .52); ctx.quadraticCurveTo(-r.r * .06, -r.r * .23, -r.r * .45, -r.r * .19); ctx.fill();
    ctx.fillStyle = 'rgba(50,55,98,.27)'; ctx.beginPath(); ctx.moveTo(-r.r, r.r * .47); ctx.quadraticCurveTo(-r.r * .2, r.r * .14, r.r * .85, .1 * r.r); ctx.lineTo(r.r, r.r * .36); ctx.quadraticCurveTo(0, r.r * .8, -r.r, r.r * .47); ctx.fill();
    ctx.restore();
  }
  function drawPellet(p, time) {
    if (!inView(p.x, p.y, 35)) return;
    const color = ORB_COLORS[p.color];
    const pulse = 1 + Math.sin(time * 3 + p.phase) * .08;
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(pulse, pulse);
    ctx.shadowColor = color; ctx.shadowBlur = 18;
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,.56)';
    ctx.beginPath(); ctx.ellipse(-p.r * .3, -p.r * .37, p.r * .34, p.r * .18, -.5, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function drawSnake(snake) {
    if (!snake.alive || !inView(snake.x, snake.y, snake.length + 70)) return;
    const palette = COLORS[snake.color];
    const path = snake.trail;
    ctx.save();
    ctx.shadowColor = palette.glow; ctx.shadowBlur = snake === player ? 23 : 12;
    ctx.strokeStyle = palette.base; ctx.lineWidth = 37; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = path.length - 1; i >= 0; i--) {
      const p = path[i]; if (i === path.length - 1) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke(); ctx.shadowBlur = 0;
    // Short strokes sit on the continuous body to make clean curved stripes.
    ctx.strokeStyle = palette.light; ctx.lineWidth = 36; ctx.lineCap = 'butt';
    for (let i = 8; i < path.length - 5; i += 16) {
      ctx.beginPath(); ctx.moveTo(path[i].x, path[i].y);
      for (let j = i + 1; j <= Math.min(i + 8, path.length - 6); j++) ctx.lineTo(path[j].x, path[j].y);
      ctx.stroke();
    }
    ctx.translate(snake.x, snake.y); ctx.rotate(snake.angle);
    const head = ctx.createRadialGradient(-8, -10, 3, 0, 0, 28);
    head.addColorStop(0, palette.light); head.addColorStop(.63, palette.base); head.addColorStop(1, palette.dark);
    ctx.fillStyle = head; ctx.shadowColor = palette.glow; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.ellipse(0, 0, 23, 21, 0, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,.19)';
    ctx.beginPath(); ctx.arc(16, 4, 4, 0, Math.PI); ctx.fill();
    for (const y of [-9, 9]) {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(8, y, 7.6, 8.4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#152344'; ctx.beginPath(); ctx.arc(11, y + .7, 4.4, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(12, y - 1.1, 1.5, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = 'rgba(18,42,64,.28)'; ctx.beginPath(); ctx.arc(-9, -12, 2, 0, TAU); ctx.arc(-13, 11, 2, 0, TAU); ctx.fill();
    ctx.restore();
    if (snake === player) drawCrown(snake.x, snake.y - 39);
    if (snake.boost) {
      ctx.strokeStyle = 'rgba(255,220,89,.28)'; ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        const x = snake.x - Math.cos(snake.angle) * (35 + i * 19);
        const y = snake.y - Math.sin(snake.angle) * (35 + i * 19);
        ctx.beginPath(); ctx.arc(x, y, 18 + i * 4, snake.angle + 2.5, snake.angle + 3.8); ctx.stroke();
      }
    }
  }
  function drawCrown(x, y) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-.12);
    ctx.shadowColor = '#ffd23c'; ctx.shadowBlur = 16; ctx.fillStyle = '#ffd748';
    ctx.beginPath(); ctx.moveTo(-16, 4); ctx.lineTo(-21, -12); ctx.lineTo(-8, -5); ctx.lineTo(0, -19); ctx.lineTo(8, -5); ctx.lineTo(21, -12); ctx.lineTo(16, 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffe680'; ctx.fillRect(-16, 4, 32, 5); ctx.restore();
  }
  function render(time) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGrid();
    ctx.save(); ctx.translate(-camera.x, -camera.y);
    bushes.forEach(drawBush);
    rocks.forEach(drawRock);
    pellets.forEach(p => drawPellet(p, time));
    snakes.filter(s => s !== player).forEach(drawSnake);
    drawSnake(player);
    ctx.restore();
  }
  function frame(timestamp) {
    const dt = Math.min((timestamp - (lastTime || timestamp)) / 1000, .04);
    lastTime = timestamp;
    if (mode === 'playing') {
      for (const snake of snakes) updateSnake(snake, dt);
      checkCollisions();
      camera.x += (player.x - width / 2 - camera.x) * Math.min(1, dt * 5);
      camera.y += (player.y - height / 2 - camera.y) * Math.min(1, dt * 5);
      if (timestamp - lastHud > 180) { updateHud(); lastHud = timestamp; }
    }
    render(timestamp / 1000);
    requestAnimationFrame(frame);
  }

  function setPointerDirection(event) {
    const dx = event.clientX - width / 2, dy = event.clientY - height / 2;
    if (Math.hypot(dx, dy) > 20) pointerDirection = Math.atan2(dy, dx);
  }
  function moveJoystick(event) {
    const box = ui.joystick.getBoundingClientRect();
    const dx = event.clientX - (box.left + box.width / 2);
    const dy = event.clientY - (box.top + box.height / 2);
    const limit = box.width * .27;
    const scale = Math.min(1, limit / Math.max(1, Math.hypot(dx, dy)));
    ui.knob.style.transform = `translate(calc(-50% + ${dx * scale}px), calc(-50% + ${dy * scale}px))`;
    if (Math.hypot(dx, dy) > 10) joystickDirection = Math.atan2(dy, dx);
  }
  function releaseJoystick() {
    joystickId = null; joystickDirection = null;
    ui.joystick.classList.remove('active');
    ui.knob.style.transform = 'translate(-50%, -50%)';
  }
  ui.joystick.addEventListener('pointerdown', event => {
    if (mode !== 'playing') return;
    joystickId = event.pointerId; ui.joystick.setPointerCapture(event.pointerId);
    ui.joystick.classList.add('active'); moveJoystick(event); event.preventDefault();
  });
  ui.joystick.addEventListener('pointermove', event => { if (event.pointerId === joystickId) moveJoystick(event); });
  ui.joystick.addEventListener('pointerup', releaseJoystick);
  ui.joystick.addEventListener('pointercancel', releaseJoystick);
  canvas.addEventListener('pointermove', event => {
    if (mode !== 'playing') return;
    if (event.pointerType === 'mouse' || event.pointerId === touchSteeringId) setPointerDirection(event);
  });
  canvas.addEventListener('pointerdown', event => {
    if (mode !== 'playing' || event.pointerType === 'mouse') return;
    touchSteeringId = event.pointerId; canvas.setPointerCapture(event.pointerId);
    setPointerDirection(event);
  });
  canvas.addEventListener('pointerup', event => { if (event.pointerId === touchSteeringId) touchSteeringId = null; });
  canvas.addEventListener('pointercancel', event => { if (event.pointerId === touchSteeringId) touchSteeringId = null; });
  ui.boost.addEventListener('pointerdown', event => {
    if (mode !== 'playing') return;
    boostPressed = true; ui.boost.classList.add('active');
    ui.boost.setPointerCapture(event.pointerId); event.preventDefault();
  });
  const stopBoost = () => { boostPressed = keys.has(' '); ui.boost.classList.toggle('active', boostPressed); };
  ui.boost.addEventListener('pointerup', stopBoost);
  ui.boost.addEventListener('pointercancel', stopBoost);
  window.addEventListener('keydown', event => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(key)) event.preventDefault();
    keys.add(key);
    if (key === 'p' || key === 'Escape') pause();
    if (key === ' ' && mode === 'playing') { boostPressed = true; ui.boost.classList.add('active'); }
    if (key === 'Enter' && mode !== 'playing') start();
  });
  window.addEventListener('keyup', event => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    keys.delete(key);
    if (key === ' ') stopBoost();
  });
  window.addEventListener('blur', () => { keys.clear(); if (mode === 'playing') pause(); });
  ui.primary.addEventListener('click', start);
  ui.pause.addEventListener('click', pause);
  window.addEventListener('resize', resize);
  resize(); reset(); showOverlay('menu'); requestAnimationFrame(frame);
})();

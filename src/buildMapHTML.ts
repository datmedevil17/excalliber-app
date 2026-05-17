import { RIFLE_MP3_B64 } from './rifleAudioData';

export function buildMapHTML(characterB64: string, mapB64: string, weaponBone: string = 'AK'): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no, maximum-scale=1">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:100%; height:100%; overflow:hidden; background:#0a0a0f; touch-action:none; }
    canvas { position:fixed; inset:0; display:block; }

    #loading {
      position:fixed; inset:0; background:#0a0a0f;
      display:flex; flex-direction:column;
      align-items:center; justify-content:center;
      z-index:20; transition:opacity .6s;
    }
    #loading p { color:#e0c97f; font-family:sans-serif; font-size:16px; margin-top:14px; letter-spacing:2px; }
    .spinner {
      width:44px; height:44px; border:4px solid #e0c97f;
      border-top-color:transparent; border-radius:50%;
      animation:spin .9s linear infinite;
    }
    @keyframes spin { to { transform:rotate(360deg); } }

    /* joystick */
    #joy-base {
      position:fixed; display:none; z-index:10;
      width:120px; height:120px; border-radius:50%; pointer-events:none;
      background:rgba(255,255,255,.07); border:2px solid rgba(255,255,255,.2);
    }
    #joy-knob {
      position:absolute; width:50px; height:50px; top:50%; left:50%;
      transform:translate(-50%,-50%); border-radius:50%;
      background:rgba(255,255,255,.28); border:2px solid rgba(255,255,255,.5);
    }

    /* fire button */
    #fire-btn {
      position:fixed; right:32px; bottom:40px; z-index:10;
      width:76px; height:76px; border-radius:50%;
      background:rgba(220,60,30,.9); border:3px solid rgba(255,120,80,.8);
      display:flex; align-items:center; justify-content:center;
      font-family:sans-serif; font-size:11px; font-weight:800;
      color:#fff; letter-spacing:2px; user-select:none;
      box-shadow:0 0 18px rgba(220,60,30,.5);
    }
  </style>
</head>
<body>
  <div id="loading"><div class="spinner"></div><p>LOADING…</p></div>
  <div id="joy-base"><div id="joy-knob"></div></div>
  <div id="fire-btn">FIRE</div>

  <script type="importmap">
  { "imports": {
      "three":         "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
  } }
  </script>

  <script type="module">
    import * as THREE     from 'three';
    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

    const MAP_B64       = '${mapB64}';
    const CHAR_B64      = '${characterB64}';
    const RIFLE_MP3_B64 = '${RIFLE_MP3_B64}';
    const WEAPON_BONE   = '${weaponBone}';
    const ALL_WEAPONS   = ['AK','GrenadeLauncher','Knife_1','Knife_2','Pistol','Revolver','Revolver_Small','RocketLauncher','ShortCannon','Shotgun','Shovel','SMG','Sniper','Sniper_2'];

    /* ── Renderer ─────────────────────────────────────────────── */
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    renderer.toneMapping       = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    document.body.appendChild(renderer.domElement);

    /* ── Scene ────────────────────────────────────────────────── */
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0f);
    scene.fog = new THREE.Fog(0x0a0a0f, 60, 120);

    /* ── Camera ───────────────────────────────────────────────── */
    const CAM_Y = 16, CAM_Z = 12;
    const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 300);
    camera.position.set(0, CAM_Y, CAM_Z);

    /* ── Lights ───────────────────────────────────────────────── */
    scene.add(new THREE.HemisphereLight(0x8ab4f8, 0x2d4a1e, 0.6));
    const sun = new THREE.DirectionalLight(0xfff5d0, 2.4);
    sun.position.set(18, 35, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.width = sun.shadow.mapSize.height = 2048;
    sun.shadow.radius = 4; sun.shadow.bias = -0.0005;
    sun.shadow.camera.near = 1;   sun.shadow.camera.far    = 120;
    sun.shadow.camera.left = -30; sun.shadow.camera.right  = 30;
    sun.shadow.camera.top  = 30;  sun.shadow.camera.bottom = -30;
    scene.add(sun);
    const fillL = new THREE.DirectionalLight(0x6088cc, 0.5);
    fillL.position.set(-15, 20, -10);
    scene.add(fillL);
    scene.add(new THREE.PointLight(0x3a5c2a, 0.8, 60));

    /* ── Shared state ─────────────────────────────────────────── */
    const loader      = new GLTFLoader();
    const mapMeshes   = [];
    const spawnPoints = [];
    const mixers      = [];
    const GRAVITY     = 18, SPEED = 5.0, P_RADIUS = 0.45, P_HEIGHT = 0.9;
    const player      = { pos: new THREE.Vector3(0, 2, 0), velY: 0, mesh: null, yaw: 0 };
    const rayDown   = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0,-1,0), 0.05, 5);
    const rayFwd    = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(), 0, 0.8);

    /* ── Rifle audio ──────────────────────────────────────────── */
    const rifleAudio = new Audio('data:audio/mp3;base64,' + RIFLE_MP3_B64);
    rifleAudio.volume = 0.8;

    /* ── Animation refs ───────────────────────────────────────── */
    let idleAct = null, runAct = null, idleShootAct = null, runShootAct = null, deathAct = null;
    let curAct  = null, isDead = false, isShooting = false;
    const FIRE_RATE = 380;
    let lastFire = 0;

    function setAnim(act) {
      if (!act || act === curAct) return;
      act.reset().play();
      if (curAct) curAct.crossFadeTo(act, 0.2, true);
      curAct = act;
    }

    /* ── Bullets ──────────────────────────────────────────────── */
    const bulletMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('hotpink').multiplyScalar(6), toneMapped: false });
    const bulletGeo = new THREE.BoxGeometry(0.05, 0.05, 0.5);
    const BULLET_SPEED  = 28;
    const BULLET_LIFE   = 1.8;
    const bullets = [];  // { mesh, dir, age, raycaster }

    function spawnBullet() {
      if (!player.mesh) return;
      const mesh = new THREE.Mesh(bulletGeo, bulletMat);
      const offset = new THREE.Vector3(-0.2, 1.4, 0.8);
      offset.applyEuler(new THREE.Euler(0, player.yaw, 0));
      mesh.position.copy(player.pos).add(offset);
      mesh.rotation.y = player.yaw;
      scene.add(mesh);
      const dir = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
      const ray = new THREE.Raycaster(mesh.position.clone(), dir.clone(), 0, BULLET_SPEED * 0.06);
      bullets.push({ mesh, dir, age: 0, ray });
    }

    function removeBullet(i) {
      scene.remove(bullets[i].mesh);
      bullets.splice(i, 1);
    }

    function updateBullets(dt) {
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.age += dt;
        if (b.age > BULLET_LIFE) { removeBullet(i); continue; }

        const step = BULLET_SPEED * dt;
        b.ray.ray.origin.copy(b.mesh.position);
        b.ray.far = step + 0.3;
        const hits = mapMeshes.length > 0 ? b.ray.intersectObjects(mapMeshes, false) : [];
        if (hits.length > 0) { removeBullet(i); continue; }

        b.mesh.position.addScaledVector(b.dir, step);
      }
    }

    /* ── Load progress ────────────────────────────────────────── */
    let loadedCount = 0;
    function onAssetLoaded() {
      if (++loadedCount < 2) return;
      const el = document.getElementById('loading');
      el.style.opacity = '0';
      setTimeout(() => el.style.display = 'none', 650);
    }

    /* ── Load MAP (GLB → ArrayBuffer) ─────────────────────────── */
    const raw = atob(MAP_B64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

    loader.parse(bytes.buffer, '', gltf => {
      const map = gltf.scene;
      map.updateMatrixWorld(true);
      map.traverse(c => {
        if (c.name && c.name.startsWith('spawn')) {
          const wp = new THREE.Vector3();
          c.getWorldPosition(wp);
          spawnPoints.push(wp.clone());
          return;
        }
        if (!c.isMesh) return;
        c.castShadow = c.receiveShadow = true;
        mapMeshes.push(c);
        if (c.material) {
          (Array.isArray(c.material) ? c.material : [c.material]).forEach(m => { m.needsUpdate = true; });
        }
      });
      scene.add(map);
      onAssetLoaded();
    }, err => { document.querySelector('#loading p').textContent = 'Load error'; console.error(err); });

    /* ── Load Character (GLTF text) ───────────────────────────── */
    loader.parse(atob(CHAR_B64), '', gltf => {
      const mesh = gltf.scene;
      mesh.traverse(c => {
        if (c.isMesh) { c.castShadow = c.receiveShadow = true; }
        /* show only selected weapon bone, hide all others */
        if (ALL_WEAPONS.includes(c.name)) { c.visible = (c.name === WEAPON_BONE); }
      });

      /* pick a random spawn point if available */
      if (spawnPoints.length > 0) {
        const sp = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
        player.pos.set(sp.x, sp.y + 1, sp.z);
      }
      mesh.position.copy(player.pos);
      scene.add(mesh);
      player.mesh = mesh;

      const mixer = new THREE.AnimationMixer(mesh);
      const clips = gltf.animations;
      const get   = (...names) => { for (const n of names) { const c = THREE.AnimationClip.findByName(clips, n); if (c) return mixer.clipAction(c); } return null; };

      idleAct      = get('Idle', 'idle');
      runAct       = get('Run', 'run', 'Walk', 'walk');
      idleShootAct = get('Idle_Shoot', 'idle_shoot', 'Shoot', 'shoot', 'Fire', 'fire');
      runShootAct  = get('Run_Shoot', 'run_shoot');
      deathAct     = get('Death', 'Die', 'Dead', 'death', 'die');

      if (deathAct)     { deathAct.setLoop(THREE.LoopOnce, 1);     deathAct.clampWhenFinished = true; }
      if (idleShootAct) { idleShootAct.setLoop(THREE.LoopOnce, 1); idleShootAct.clampWhenFinished = false; }
      if (runShootAct)  { runShootAct.setLoop(THREE.LoopOnce, 1);  runShootAct.clampWhenFinished = false; }
      setAnim(idleAct);

      mixers.push(mixer);
      onAssetLoaded();
    }, err => { console.error('char', err); onAssetLoaded(); });

    /* ════════════════════════════════════════════════════════════
       JOYSTICK — left half
    ════════════════════════════════════════════════════════════ */
    const joyBase = document.getElementById('joy-base');
    const joyKnob = document.getElementById('joy-knob');
    const JOY_R   = 48;
    let joyId = -1, joyCX = 0, joyCY = 0, joyDx = 0, joyDy = 0;

    document.addEventListener('touchstart', e => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.clientX > innerWidth * 0.5 || joyId !== -1) continue;
        joyId = t.identifier; joyCX = t.clientX; joyCY = t.clientY;
        joyBase.style.cssText += ';left:'+(joyCX-60)+'px;top:'+(joyCY-60)+'px;display:block;';
        joyKnob.style.transform = 'translate(-50%,-50%)';
      }
    }, { passive: true });

    document.addEventListener('touchmove', e => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier !== joyId) continue;
        let dx = t.clientX - joyCX, dy = t.clientY - joyCY;
        const len = Math.sqrt(dx*dx + dy*dy);
        if (len > JOY_R) { dx = dx/len*JOY_R; dy = dy/len*JOY_R; }
        joyDx = dx / JOY_R; joyDy = dy / JOY_R;
        joyKnob.style.transform = 'translate(calc(-50% + '+dx+'px),calc(-50% + '+dy+'px))';
      }
    }, { passive: true });

    function joyEnd(e) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier !== joyId) continue;
        joyId = -1; joyDx = 0; joyDy = 0;
        joyBase.style.display = 'none';
      }
    }
    document.addEventListener('touchend',    joyEnd, { passive: true });
    document.addEventListener('touchcancel', joyEnd, { passive: true });

    /* ════════════════════════════════════════════════════════════
       FIRE BUTTON
    ════════════════════════════════════════════════════════════ */
    document.getElementById('fire-btn').addEventListener('touchstart', e => {
      e.stopPropagation();
      if (isDead || !player.mesh) return;
      const now = performance.now();
      if (now - lastFire < FIRE_RATE) return;
      lastFire = now;

      rifleAudio.currentTime = 0;
      rifleAudio.play().catch(() => {});
      spawnBullet();

      const moving   = Math.abs(joyDx) > 0.05 || Math.abs(joyDy) > 0.05;
      const shootAct = (moving && runShootAct) ? runShootAct : (idleShootAct || runShootAct);
      if (shootAct) {
        isShooting = true;
        setAnim(shootAct);
        const dur = Math.max((shootAct.getClip().duration - 0.2) * 1000, 300);
        setTimeout(() => {
          isShooting = false;
          const m = Math.abs(joyDx) > 0.05 || Math.abs(joyDy) > 0.05;
          setAnim(m ? (runAct || idleAct) : idleAct);
        }, dur);
      }
    }, { passive: true });

    /* ════════════════════════════════════════════════════════════
       PHYSICS
    ════════════════════════════════════════════════════════════ */
    function physicsStep(dt) {
      if (!player.mesh || mapMeshes.length === 0 || isDead) return;
      const p = player.pos;
      const ms = SPEED * dt;
      let mx = joyDx * ms, mz = joyDy * ms;

      if (mx !== 0 || mz !== 0) {
        player.yaw = Math.atan2(mx, mz);
        player.mesh.rotation.y = player.yaw;
        const dir = new THREE.Vector3(mx, 0, mz).normalize();
        rayFwd.ray.origin.set(p.x, p.y + P_HEIGHT, p.z);
        rayFwd.ray.direction.copy(dir);
        const hits = rayFwd.intersectObjects(mapMeshes, false);
        if (hits.length === 0 || hits[0].distance > P_RADIUS) {
          p.x += mx; p.z += mz;
        } else {
          const tx = new THREE.Vector3(mx, 0, 0).normalize();
          rayFwd.ray.direction.copy(tx);
          if (!rayFwd.intersectObjects(mapMeshes, false).some(h => h.distance <= P_RADIUS)) p.x += mx;
          const tz = new THREE.Vector3(0, 0, mz).normalize();
          rayFwd.ray.direction.copy(tz);
          if (!rayFwd.intersectObjects(mapMeshes, false).some(h => h.distance <= P_RADIUS)) p.z += mz;
        }
      }

      player.velY -= GRAVITY * dt;
      p.y += player.velY * dt;
      rayDown.ray.origin.set(p.x, p.y + P_HEIGHT + 0.3, p.z);
      const gnd = rayDown.intersectObjects(mapMeshes, false);
      if (gnd.length > 0 && gnd[0].distance < P_HEIGHT + 0.5) {
        p.y = gnd[0].point.y; player.velY = 0;
      } else if (p.y < -10) { p.y = -10; player.velY = 0; }
      player.mesh.position.copy(p);
    }

    /* ════════════════════════════════════════════════════════════
       CAMERA
    ════════════════════════════════════════════════════════════ */
    const camTarget  = new THREE.Vector3();
    const lookTarget = new THREE.Vector3();
    function cameraFollow() {
      const p = player.pos;
      camTarget.set(p.x, p.y + CAM_Y, p.z + CAM_Z);
      camera.position.lerp(camTarget, 0.12);
      lookTarget.set(p.x, p.y + 1.5, p.z);
      camera.lookAt(lookTarget);
    }

    /* ════════════════════════════════════════════════════════════
       ANIMATION STATE
    ════════════════════════════════════════════════════════════ */
    function animStep() {
      if (isDead || isShooting || !player.mesh) return;
      const moving = Math.abs(joyDx) > 0.05 || Math.abs(joyDy) > 0.05;
      setAnim(moving ? (runAct || idleAct) : idleAct);
    }

    /* ── Render loop ──────────────────────────────────────────── */
    const clock = new THREE.Clock();
    (function animate() {
      requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      physicsStep(dt);
      updateBullets(dt);
      animStep();
      for (let i = 0; i < mixers.length; i++) mixers[i].update(dt);
      cameraFollow();
      renderer.render(scene, camera);
    })();

    window.addEventListener('resize', () => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    });
  </script>
</body>
</html>`;
}

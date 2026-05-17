import { MAP_GLB_B64 }  from './mapData';
import { SOLDIER_B64 }  from './soldierData';

export function buildGameHTML(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no,maximum-scale=1">
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    html,body{width:100%;height:100%;overflow:hidden;background:#000;touch-action:none;}
    canvas{position:fixed;inset:0;display:block;}

    #loading{
      position:fixed;inset:0;background:#04050d;
      display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:20;
      transition:opacity .5s;
    }
    #loading p{color:#e0c97f;font-family:sans-serif;font-size:15px;margin-top:12px;letter-spacing:2px;}
    #load-bar{margin-top:16px;width:160px;height:4px;background:rgba(224,201,127,.2);border-radius:2px;overflow:hidden;}
    #load-fill{height:100%;width:0%;background:#e0c97f;border-radius:2px;transition:width .25s;}
    .spinner{width:44px;height:44px;border:4px solid #e0c97f;border-top-color:transparent;border-radius:50%;animation:spin .9s linear infinite;}
    @keyframes spin{to{transform:rotate(360deg);}}

    /* floating joystick */
    #joy-base{
      position:fixed;display:none;z-index:10;
      width:120px;height:120px;border-radius:50%;pointer-events:none;
      background:rgba(255,255,255,.07);border:2px solid rgba(255,255,255,.2);
    }
    #joy-knob{
      position:absolute;width:50px;height:50px;top:50%;left:50%;
      transform:translate(-50%,-50%);border-radius:50%;
      background:rgba(255,255,255,.28);border:2px solid rgba(255,255,255,.5);
    }

    /* crosshair */
    #xhair{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:16px;height:16px;pointer-events:none;z-index:5;}
    #xhair::before,#xhair::after{content:'';position:absolute;background:rgba(255,255,255,.55);border-radius:1px;}
    #xhair::before{width:2px;height:100%;left:50%;transform:translateX(-50%);}
    #xhair::after{height:2px;width:100%;top:50%;transform:translateY(-50%);}
  </style>
</head>
<body>
  <div id="loading"><div class="spinner"></div><p>LOADING ARENA…</p><div id="load-bar"><div id="load-fill"></div></div></div>
  <div id="joy-base"><div id="joy-knob"></div></div>
  <div id="xhair"></div>

  <script type="importmap">
  {"imports":{
    "three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js",
    "three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
  }}
  </script>

  <script type="module">
    import * as THREE     from 'three';
    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

    const MAP_B64     = '${MAP_GLB_B64}';
    const SOLDIER_B64 = '${SOLDIER_B64}';

    /* ── Renderer ──────────────────────────────────────────── */
    const renderer = new THREE.WebGLRenderer({ antialias:true });
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    renderer.setSize(innerWidth,innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    renderer.toneMapping       = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    document.body.appendChild(renderer.domElement);

    /* ── Scene ─────────────────────────────────────────────── */
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87a8c8);
    scene.fog = new THREE.Fog(0x87a8c8, 40, 80);

    /* ── Camera — third-person top-down (like r3f game) ───── */
    const camera = new THREE.PerspectiveCamera(52, innerWidth/innerHeight, 0.1, 200);
    const CAM_Y  = 16, CAM_Z = 12; // camera offset from player

    /* ── Lights ────────────────────────────────────────────── */
    scene.add(new THREE.HemisphereLight(0x9bbde0, 0x3a5a1e, 0.7));

    const sun = new THREE.DirectionalLight(0xfff5d0, 2.6);
    sun.position.set(15, 30, 10);
    sun.castShadow            = true;
    sun.shadow.mapSize.set(2048,2048);
    sun.shadow.radius         = 3;
    sun.shadow.bias           = -0.0005;
    sun.shadow.camera.near    = 1;
    sun.shadow.camera.far     = 100;
    sun.shadow.camera.left    = -30;  sun.shadow.camera.right  = 30;
    sun.shadow.camera.top     = 30;   sun.shadow.camera.bottom = -30;
    scene.add(sun);

    const fill = new THREE.DirectionalLight(0x6080c0, 0.4);
    fill.position.set(-12,20,-8);
    scene.add(fill);

    /* ── Shared state ──────────────────────────────────────── */
    const loader     = new THREE.GLTFLoader();
    const mapMeshes  = [];   // collected for raycasting
    const mixers     = [];

    // Player state
    const player = {
      pos    : new THREE.Vector3(0, 4, 0),
      velY   : 0,
      onGround: false,
      mesh   : null,
      yaw    : 0,
    };

    // Reusable raycasters
    const rayDown = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0,-1,0), 0.05, 5);
    const rayFwd  = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(), 0.0, 0.8);

    /* ── Load progress ─────────────────────────────────────── */
    let loaded = 0;
    const fill$ = document.getElementById('load-fill');
    function onLoaded() { loaded++; fill$.style.width = (loaded/2*100)+'%'; }

    /* ── Load MAP (GLB = ArrayBuffer) ──────────────────────── */
    function b64ToBuffer(b64) {
      const raw   = atob(b64);
      const bytes = new Uint8Array(raw.length);
      for (let i=0;i<raw.length;i++) bytes[i]=raw.charCodeAt(i);
      return bytes.buffer;
    }

    loader.parse(b64ToBuffer(MAP_B64), '', mapGltf => {
      const map = mapGltf.scene;
      map.traverse(c => {
        if (!c.isMesh) return;
        c.castShadow = c.receiveShadow = true;
        mapMeshes.push(c);
      });
      scene.add(map);
      onLoaded();
    }, e => console.error('map',e));

    /* ── Load Soldier (GLTF text with embedded data) ───────── */
    loader.parse(atob(SOLDIER_B64), '', solGltf => {
      const mesh = solGltf.scene;
      mesh.traverse(c => { if (c.isMesh) c.castShadow = c.receiveShadow = true; });
      mesh.scale.setScalar(1.0);
      scene.add(mesh);
      player.mesh = mesh;

      const mixer  = new THREE.AnimationMixer(mesh);
      const clips  = solGltf.animations;
      const get    = name => { const c=THREE.AnimationClip.findByName(clips,name); return c?mixer.clipAction(c):null; };
      const idleAct = get('Idle');
      const runAct  = get('Run');
      let   curAct  = null;

      function setAnim(act) {
        if (!act || act===curAct) return;
        if (curAct) curAct.crossFadeTo(act,.25,true);
        act.play();
        curAct = act;
      }
      setAnim(idleAct);

      mixers.push({
        update(dt) {
          mixer.update(dt);
          const moving = joyDx!==0||joyDy!==0;
          setAnim(moving ? runAct : idleAct);
        }
      });

      onLoaded();
    }, e => console.error('soldier',e));

    /* when both loaded → hide screen */
    const hideInterval = setInterval(() => {
      if (loaded < 2) return;
      clearInterval(hideInterval);
      const el = document.getElementById('loading');
      el.style.opacity='0';
      setTimeout(()=>el.style.display='none',600);
    }, 100);

    /* ════════════════════════════════════════════════════════
       INPUT — floating joystick (left half) only
    ════════════════════════════════════════════════════════ */
    const joyBase = document.getElementById('joy-base');
    const joyKnob = document.getElementById('joy-knob');
    const JOY_R   = 48;
    let joyId=-1, joyCX=0, joyCY=0, joyDx=0, joyDy=0;

    function onStart(e){
      for(let i=0;i<e.changedTouches.length;i++){
        const t=e.changedTouches[i];
        if(t.clientX > innerWidth*.5) continue;  // only left half
        if(joyId!==-1) continue;
        joyId=t.identifier; joyCX=t.clientX; joyCY=t.clientY;
        joyBase.style.left=(joyCX-60)+'px';
        joyBase.style.top =(joyCY-60)+'px';
        joyBase.style.display='block';
        joyKnob.style.transform='translate(-50%,-50%)';
      }
    }
    function onMove(e){
      for(let i=0;i<e.changedTouches.length;i++){
        const t=e.changedTouches[i];
        if(t.identifier!==joyId) continue;
        let dx=t.clientX-joyCX, dy=t.clientY-joyCY;
        const len=Math.sqrt(dx*dx+dy*dy);
        if(len>JOY_R){dx=dx/len*JOY_R;dy=dy/len*JOY_R;}
        joyDx=dx/JOY_R; joyDy=dy/JOY_R;
        joyKnob.style.transform='translate(calc(-50% + '+dx+'px),calc(-50% + '+dy+'px))';
      }
    }
    function onEnd(e){
      for(let i=0;i<e.changedTouches.length;i++){
        if(e.changedTouches[i].identifier!==joyId) continue;
        joyId=-1; joyDx=0; joyDy=0;
        joyBase.style.display='none';
      }
    }
    document.addEventListener('touchstart', onStart,{passive:true});
    document.addEventListener('touchmove',  onMove, {passive:true});
    document.addEventListener('touchend',   onEnd,  {passive:true});
    document.addEventListener('touchcancel',onEnd,  {passive:true});
    renderer.domElement.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});

    /* ════════════════════════════════════════════════════════
       PHYSICS
    ════════════════════════════════════════════════════════ */
    const GRAVITY   = 18;
    const SPEED     = 7.0;
    const P_RADIUS  = 0.45;  // horizontal collision radius
    const P_HEIGHT  = 0.9;   // half-height of capsule (eye to feet offset)

    function physicsStep(dt){
      if (!player.mesh || mapMeshes.length===0) return;

      const p = player.pos;

      /* ── horizontal movement ── */
      const MOVE_SPEED = SPEED * dt;
      let   moveX = joyDx * MOVE_SPEED;
      let   moveZ = joyDy * MOVE_SPEED;

      if (moveX!==0 || moveZ!==0) {
        /* character faces movement direction */
        player.mesh.rotation.y = Math.atan2(moveX, moveZ);

        /* wall collision: cast a ray in movement direction */
        const moveDir = new THREE.Vector3(moveX,0,moveZ).normalize();
        rayFwd.ray.origin.set(p.x, p.y+P_HEIGHT, p.z);
        rayFwd.ray.direction.copy(moveDir);
        const wallHits = rayFwd.intersectObjects(mapMeshes,false);

        if (wallHits.length===0 || wallHits[0].distance > P_RADIUS) {
          p.x += moveX;
          p.z += moveZ;
        } else {
          /* try sliding: separate X and Z */
          const tryX = new THREE.Vector3(moveX,0,0).normalize();
          rayFwd.ray.direction.copy(tryX);
          const hX = rayFwd.intersectObjects(mapMeshes,false);
          if (hX.length===0 || hX[0].distance>P_RADIUS) p.x += moveX;

          const tryZ = new THREE.Vector3(0,0,moveZ).normalize();
          rayFwd.ray.direction.copy(tryZ);
          const hZ = rayFwd.intersectObjects(mapMeshes,false);
          if (hZ.length===0 || hZ[0].distance>P_RADIUS) p.z += moveZ;
        }
      }

      /* ── gravity + ground ── */
      player.velY -= GRAVITY * dt;
      p.y += player.velY * dt;

      rayDown.ray.origin.set(p.x, p.y + P_HEIGHT + 0.3, p.z);
      const groundHits = rayDown.intersectObjects(mapMeshes,false);
      if (groundHits.length>0 && groundHits[0].distance < P_HEIGHT+0.5) {
        p.y = groundHits[0].point.y;
        player.velY   = 0;
        player.onGround = true;
      } else {
        player.onGround = false;
        /* hard floor fallback */
        if (p.y < -10) { p.y=-10; player.velY=0; }
      }

      player.mesh.position.copy(p);
    }

    /* ════════════════════════════════════════════════════════
       CAMERA — smooth follow (same offset as r3f game)
    ════════════════════════════════════════════════════════ */
    const camTarget = new THREE.Vector3();
    const lookTarget= new THREE.Vector3();

    function cameraFollow(){
      const p = player.pos;
      camTarget.set(p.x, p.y + CAM_Y, p.z + CAM_Z);
      camera.position.lerp(camTarget, 0.12);
      lookTarget.set(p.x, p.y + 1.5, p.z);
      camera.lookAt(lookTarget);
    }

    /* ════════════════════════════════════════════════════════
       LOOP
    ════════════════════════════════════════════════════════ */
    const clock = new THREE.Clock();
    (function animate(){
      requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      physicsStep(dt);
      for(let i=0;i<mixers.length;i++) mixers[i].update(dt);
      cameraFollow();
      renderer.render(scene,camera);
    })();

    window.addEventListener('resize',()=>{
      camera.aspect=innerWidth/innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth,innerHeight);
    });
  </script>
</body>
</html>`;
}

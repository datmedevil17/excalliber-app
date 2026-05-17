import { BIGTREE_B64 }     from './bigTreeData';
import { ZOMBIEBASIC_B64 } from './zombiebasicData';

export function buildSimpleSurvivalHTML(characterB64: string, weaponBone: string = 'AK'): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no,maximum-scale=1">
  <style>
    *{margin:0;padding:0;}
    html,body{width:100%;height:100%;overflow:hidden;background:#000;touch-action:none;}
    canvas{position:fixed;inset:0;display:block;}
    #loading{position:fixed;inset:0;background:#04050d;display:flex;flex-direction:column;
      align-items:center;justify-content:center;z-index:20;transition:opacity .5s;}
    #loading p{color:#e0c97f;font-family:sans-serif;font-size:14px;margin-top:12px;letter-spacing:3px;}
    .spinner{width:40px;height:40px;border:3px solid #e0c97f;border-top-color:transparent;
      border-radius:50%;animation:sp .9s linear infinite;}
    @keyframes sp{to{transform:rotate(360deg);}}
    #joy-base{position:fixed;display:none;z-index:10;width:120px;height:120px;border-radius:50%;
      pointer-events:none;background:rgba(255,255,255,.07);border:2px solid rgba(255,255,255,.2);}
    #joy-knob{position:absolute;width:50px;height:50px;top:50%;left:50%;
      transform:translate(-50%,-50%);border-radius:50%;
      background:rgba(255,255,255,.28);border:2px solid rgba(255,255,255,.5);}
  </style>
</head>
<body>
  <div id="loading"><div class="spinner"></div><p>LOADING…</p></div>
  <div id="joy-base"><div id="joy-knob"></div></div>

  <script type="importmap">
  {"imports":{
    "three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js",
    "three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
  }}
  </script>

  <script type="module">
    import * as THREE        from 'three';
    import { GLTFLoader }    from 'three/addons/loaders/GLTFLoader.js';
    import { SkeletonUtils } from 'three/addons/utils/SkeletonUtils.js';

    const CHAR_B64    = '${characterB64}';
    const TREE_B64    = '${BIGTREE_B64}';
    const ZOMBIE_B64  = '${ZOMBIEBASIC_B64}';
    const WEAPON_BONE = '${weaponBone}';
    const ALL_WEAPONS = ['AK','GrenadeLauncher','Knife_1','Knife_2','Pistol','Revolver','Revolver_Small','RocketLauncher','ShortCannon','Shotgun','Shovel','SMG','Sniper','Sniper_2'];

    const PLAYER_RADIUS = 0.4;
    const TREE_RADIUS   = 1.2;
    const PUSH_DIST     = PLAYER_RADIUS + TREE_RADIUS;

    /* renderer */
    const renderer = new THREE.WebGLRenderer({ antialias:true });
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    renderer.setSize(innerWidth,innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    /* scene */
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 50, 100);
    scene.add(new THREE.HemisphereLight(0x9bd0f0, 0x3a7a3a, 0.8));
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(15,30,10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024,1024);
    sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
    sun.shadow.camera.top  =  60; sun.shadow.camera.bottom = -60;
    scene.add(sun);

    /* grass ground */
    function makeGrassTex(){
      const sz=512, cv=document.createElement('canvas');
      cv.width=cv.height=sz;
      const ctx=cv.getContext('2d');
      ctx.fillStyle='#3a6b2a'; ctx.fillRect(0,0,sz,sz);
      for(const [col,n] of [['#4a8c35',180],['#2e5c1e',140],['#56a03e',100]]){
        ctx.fillStyle=col;
        for(let i=0;i<n;i++){
          ctx.beginPath();
          ctx.ellipse(Math.random()*sz,Math.random()*sz,Math.random()*20+6,Math.random()*12+4,Math.random()*Math.PI,0,Math.PI*2);
          ctx.fill();
        }
      }
      for(let i=0;i<4000;i++){
        const x=Math.random()*sz, y=Math.random()*sz, h=Math.random()*12+3;
        ctx.strokeStyle=Math.random()>.5?'#72c450':'#2a5018';
        ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+(Math.random()-.5)*5,y-h); ctx.stroke();
      }
      return cv;
    }
    const gTex = new THREE.CanvasTexture(makeGrassTex());
    gTex.wrapS = gTex.wrapT = THREE.RepeatWrapping;
    gTex.repeat.set(24,24);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200,200),
      new THREE.MeshStandardMaterial({ map:gTex, roughness:.9 })
    );
    ground.rotation.x = -Math.PI/2;
    ground.receiveShadow = true;
    scene.add(ground);

    /* tree positions */
    const treePts = [];
    let attempts = 0;
    while(treePts.length < 30 && attempts < 1200){
      attempts++;
      const a=Math.random()*Math.PI*2, r=10+Math.random()*80;
      const x=Math.cos(a)*r, z=Math.sin(a)*r;
      if(x*x+z*z < 64) continue;
      let ok=true;
      for(const p of treePts){ const dx=p[0]-x,dz=p[1]-z; if(dx*dx+dz*dz<144){ok=false;break;} }
      if(ok) treePts.push([x,z]);
    }

    /* camera */
    const camera = new THREE.PerspectiveCamera(40, innerWidth/innerHeight, .1, 200);

    /* joystick */
    const joyBase=document.getElementById('joy-base');
    const joyKnob=document.getElementById('joy-knob');
    const JOY_R=48; let joyId=-1,joyCX=0,joyCY=0,joyDx=0,joyDy=0;
    document.addEventListener('touchstart',e=>{
      for(let i=0;i<e.changedTouches.length;i++){
        const t=e.changedTouches[i]; if(joyId!==-1) continue;
        joyId=t.identifier; joyCX=t.clientX; joyCY=t.clientY;
        joyBase.style.left=(joyCX-60)+'px'; joyBase.style.top=(joyCY-60)+'px';
        joyBase.style.display='block';
      }
    },{passive:true});
    document.addEventListener('touchmove',e=>{
      for(let i=0;i<e.changedTouches.length;i++){
        const t=e.changedTouches[i]; if(t.identifier!==joyId) continue;
        let dx=t.clientX-joyCX, dy=t.clientY-joyCY;
        const len=Math.sqrt(dx*dx+dy*dy); if(len>JOY_R){dx=dx/len*JOY_R;dy=dy/len*JOY_R;}
        joyDx=dx/JOY_R; joyDy=dy/JOY_R;
        joyKnob.style.transform=\`translate(calc(-50% + \${dx}px),calc(-50% + \${dy}px))\`;
      }
    },{passive:true});
    function joyEnd(e){
      for(let i=0;i<e.changedTouches.length;i++){
        if(e.changedTouches[i].identifier!==joyId) continue;
        joyId=-1; joyDx=0; joyDy=0; joyBase.style.display='none';
        joyKnob.style.transform='translate(-50%,-50%)';
      }
    }
    document.addEventListener('touchend',joyEnd,{passive:true});
    document.addEventListener('touchcancel',joyEnd,{passive:true});

    /* player */
    let pMesh=null, pMixer=null, pCurAct=null, idleAct=null, runAct=null;
    const pPos=new THREE.Vector3();

    function setAnim(act){
      if(!act||act===pCurAct) return;
      act.reset().play();
      if(pCurAct) pCurAct.crossFadeTo(act,.15,true);
      pCurAct=act;
    }

    function b64Buf(b64){
      const raw=atob(b64), buf=new Uint8Array(raw.length);
      for(let i=0;i<raw.length;i++) buf[i]=raw.charCodeAt(i);
      return buf.buffer;
    }

    /* zombie (added lazily after game loop starts) */
    let zMixer=null;
    function loadZombie(){
      new GLTFLoader().parse(b64Buf(ZOMBIE_B64),'',gltf=>{
        const mesh=SkeletonUtils.clone(gltf.scene);
        mesh.traverse(c=>{ if(c.isMesh){c.castShadow=true;c.receiveShadow=true;} });
        mesh.position.set(6,0,0);
        scene.add(mesh);
        zMixer=new THREE.AnimationMixer(mesh);
        const clip=THREE.AnimationClip.findByName(gltf.animations,'Idle');
        if(clip) zMixer.clipAction(clip).play();
      },err=>console.error('zombie',err));
    }

    /* load char + tree — these two gate the loading screen */
    let loaded=0;
    function onLoaded(){
      if(++loaded<2) return;
      const el=document.getElementById('loading');
      el.style.opacity='0';
      setTimeout(()=>el.style.display='none',500);
      loop();
      /* spawn zombie after rendering has settled */
      setTimeout(loadZombie, 2000);
    }

    new GLTFLoader().parse(b64Buf(CHAR_B64),'',gltf=>{
      pMesh=gltf.scene;
      pMesh.traverse(c=>{
        if(c.isMesh){ c.castShadow=true; c.receiveShadow=true; }
        if(ALL_WEAPONS.includes(c.name)) c.visible=(c.name===WEAPON_BONE);
      });
      scene.add(pMesh);
      pMixer=new THREE.AnimationMixer(pMesh);
      const find=n=>{ const c=THREE.AnimationClip.findByName(gltf.animations,n); return c?pMixer.clipAction(c):null; };
      idleAct=find('Idle')||find('idle');
      runAct =find('Run') ||find('run');
      setAnim(idleAct);
      onLoaded();
    },err=>{ console.error('char',err); onLoaded(); });

    new GLTFLoader().parse(b64Buf(TREE_B64),'',gltf=>{
      const proto=gltf.scene;
      proto.traverse(c=>{ if(c.isMesh){c.castShadow=true;c.receiveShadow=true;} });
      for(const [x,z] of treePts){
        const t=proto.clone(true);
        t.scale.setScalar(.9+Math.random()*.35);
        t.rotation.y=Math.random()*Math.PI*2;
        t.position.set(x,0,z);
        scene.add(t);
      }
      onLoaded();
    },err=>{ console.error('tree',err); onLoaded(); });

    /* main loop */
    const clock=new THREE.Clock();
    function loop(){
      requestAnimationFrame(loop);
      const dt=Math.min(clock.getDelta(),.05);

      if(pMesh){
        const speed=5;
        let nx=pPos.x+joyDx*speed*dt;
        let nz=pPos.z+joyDy*speed*dt;

        for(const [tx,tz] of treePts){
          const dx=nx-tx, dz=nz-tz, d2=dx*dx+dz*dz;
          if(d2>0 && d2<PUSH_DIST*PUSH_DIST){
            const d=Math.sqrt(d2), push=PUSH_DIST-d;
            nx+=dx/d*push; nz+=dz/d*push;
          }
        }
        nx=Math.max(-95,Math.min(95,nx));
        nz=Math.max(-95,Math.min(95,nz));

        const moved=nx!==pPos.x||nz!==pPos.z;
        if(moved) pMesh.rotation.y=Math.atan2(nx-pPos.x, nz-pPos.z);
        pPos.x=nx; pPos.z=nz;
        pMesh.position.copy(pPos);

        const moving=Math.abs(joyDx)>.05||Math.abs(joyDy)>.05;
        setAnim(moving?(runAct||idleAct):idleAct);
        pMixer.update(dt);

        camera.position.set(pPos.x, pPos.y+12, pPos.z+10);
        camera.lookAt(pPos.x, pPos.y+1, pPos.z);
      }

      if(zMixer) zMixer.update(dt);

      renderer.render(scene,camera);
    }

    window.addEventListener('resize',()=>{
      camera.aspect=innerWidth/innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth,innerHeight);
    });
  </script>
</body>
</html>`;
}

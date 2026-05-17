export function buildMapPreviewHTML(mapB64: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    html,body{width:100%;height:100%;overflow:hidden;background:#07090f;}
    canvas{position:fixed;inset:0;display:block;}
    #s{position:fixed;inset:0;background:#07090f;display:flex;align-items:center;justify-content:center;}
    .sp{width:28px;height:28px;border:3px solid #d4a843;border-top-color:transparent;border-radius:50%;animation:sp .8s linear infinite;}
    @keyframes sp{to{transform:rotate(360deg);}}
  </style>
</head>
<body>
  <div id="s"><div class="sp"></div></div>
  <script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script>
  <script type="module">
    import * as THREE from 'three';
    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

    const MAP_B64 = '${mapB64}';

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    document.body.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07090f);
    scene.fog = new THREE.Fog(0x07090f, 55, 100);

    const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 200);
    camera.position.set(0, 36, 0.01);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.HemisphereLight(0x8ab4f8, 0x2d4a1e, 0.7));
    const sun = new THREE.DirectionalLight(0xfff5d0, 2.2);
    sun.position.set(15, 30, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.radius = 3;
    sun.shadow.bias = -0.0005;
    sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;   sun.shadow.camera.bottom = -30;
    sun.shadow.camera.near = 1;   sun.shadow.camera.far = 100;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x6088cc, 0.4);
    fill.position.set(-12, 20, -8);
    scene.add(fill);

    const raw = atob(MAP_B64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

    new GLTFLoader().parse(bytes.buffer, '', gltf => {
      const map = gltf.scene;
      map.traverse(c => {
        if (!c.isMesh) return;
        c.castShadow = c.receiveShadow = true;
        if (c.material) {
          (Array.isArray(c.material) ? c.material : [c.material]).forEach(m => { m.needsUpdate = true; });
        }
      });
      scene.add(map);
      document.getElementById('s').style.display = 'none';
      (function loop() { requestAnimationFrame(loop); renderer.render(scene, camera); })();
    }, err => console.error(err));

    window.addEventListener('resize', () => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    });
  </script>
</body>
</html>`;
}

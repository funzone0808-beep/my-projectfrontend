/* ═══════════════════════════════════════════════════════
   AURUM — THREE.JS HERO SCENE
   Floating 3D geometric forms + particles
   ═══════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const canvas = document.getElementById("heroCanvas");
  const heroSection = document.getElementById("hero");
  if (!canvas || typeof THREE === "undefined") return;

  const HERO_SCENE_DEFAULTS = {
    enabled: true,
    preset: "default",
    toneMappingExposure: 1.2,
    cameraDistance: 12,
    ambientLightIntensity: 0.5,
    goldLightIntensity: 3.5,
    warmLightIntensity: 2.5,
    rimLightIntensity: 0.8,
    particleCount: 280,
  };
  const HERO_SCENE_MAX_PARTICLE_COUNT = 600;

  function getFiniteRuntimeValue(value, fallback) {
    const candidate = Number(value);
    return Number.isFinite(candidate) ? candidate : fallback;
  }

  function getIntegerRuntimeValue(value, fallback, min, max) {
    const candidate = Math.round(getFiniteRuntimeValue(value, fallback));
    return Math.min(Math.max(candidate, min), max);
  }

  function getHeroSceneRuntimeConfig() {
    const sceneConfig = window.APP_STATE?.heroScene;

    return {
      enabled:
        typeof sceneConfig?.enabled === "boolean"
          ? sceneConfig.enabled
          : HERO_SCENE_DEFAULTS.enabled,
      preset:
        typeof sceneConfig?.preset === "string" && sceneConfig.preset.trim()
          ? sceneConfig.preset.trim().toLowerCase()
          : HERO_SCENE_DEFAULTS.preset,
      toneMappingExposure: getFiniteRuntimeValue(
        sceneConfig?.toneMappingExposure,
        HERO_SCENE_DEFAULTS.toneMappingExposure,
      ),
      cameraDistance: getFiniteRuntimeValue(
        sceneConfig?.cameraDistance,
        HERO_SCENE_DEFAULTS.cameraDistance,
      ),
      ambientLightIntensity: getFiniteRuntimeValue(
        sceneConfig?.ambientLightIntensity,
        HERO_SCENE_DEFAULTS.ambientLightIntensity,
      ),
      goldLightIntensity: getFiniteRuntimeValue(
        sceneConfig?.goldLightIntensity,
        HERO_SCENE_DEFAULTS.goldLightIntensity,
      ),
      warmLightIntensity: getFiniteRuntimeValue(
        sceneConfig?.warmLightIntensity,
        HERO_SCENE_DEFAULTS.warmLightIntensity,
      ),
      rimLightIntensity: getFiniteRuntimeValue(
        sceneConfig?.rimLightIntensity,
        HERO_SCENE_DEFAULTS.rimLightIntensity,
      ),
      particleCount: getIntegerRuntimeValue(
        sceneConfig?.particleCount,
        HERO_SCENE_DEFAULTS.particleCount,
        0,
        HERO_SCENE_MAX_PARTICLE_COUNT,
      ),
    };
  }

  /* ── Renderer ─────────────────────────────────────── */
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  /* ── Scene & Camera ───────────────────────────────── */
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    200,
  );
  camera.position.set(0, 0, 12);

  /* ── Lights ───────────────────────────────────────── */
  const ambientLight = new THREE.AmbientLight(0xfff5e0, 0.5);
  scene.add(ambientLight);

  const goldLight = new THREE.PointLight(0xc9a84c, 3.5, 40);
  goldLight.position.set(6, 5, 8);
  scene.add(goldLight);

  const warmLight = new THREE.PointLight(0xffd59a, 2.5, 35);
  warmLight.position.set(-8, -3, 6);
  scene.add(warmLight);

  const rimLight = new THREE.DirectionalLight(0xffffff, 0.8);
  rimLight.position.set(0, 10, -5);
  scene.add(rimLight);

  /* ── Materials ────────────────────────────────────── */
  const goldMaterial = new THREE.MeshStandardMaterial({
    color: 0xc9a84c,
    metalness: 0.92,
    roughness: 0.08,
    envMapIntensity: 1.5,
  });
  const darkGoldMaterial = new THREE.MeshStandardMaterial({
    color: 0x8b6914,
    metalness: 0.95,
    roughness: 0.05,
    envMapIntensity: 1.5,
  });
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0xe8d5a3,
    metalness: 0.6,
    roughness: 0.15,
    transparent: true,
    opacity: 0.85,
  });
  const wireMaterial = new THREE.MeshBasicMaterial({
    color: 0xc9a84c,
    wireframe: true,
    transparent: true,
    opacity: 0.15,
  });

  /* ── Floating Shapes ──────────────────────────────── */
  const shapes = [];

  // Centre feature: Icosahedron (jewel-like)
  const icosaGeo = new THREE.IcosahedronGeometry(2.2, 0);
  const icosaMesh = new THREE.Mesh(icosaGeo, goldMaterial);
  icosaMesh.position.set(0.5, 0, 0);
  scene.add(icosaMesh);
  shapes.push({
    mesh: icosaMesh,
    rotX: 0.003,
    rotY: 0.005,
    floatAmp: 0.15,
    floatFreq: 0.6,
    baseY: 0,
  });

  // Wireframe overlay
  const icosaWire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.25, 0),
    wireMaterial.clone(),
  );
  icosaWire.position.copy(icosaMesh.position);
  scene.add(icosaWire);
  shapes.push({
    mesh: icosaWire,
    rotX: 0.003,
    rotY: 0.005,
    floatAmp: 0.15,
    floatFreq: 0.6,
    baseY: 0,
  });

  // Orbiting torus
  const torusGeo = new THREE.TorusGeometry(3.5, 0.06, 8, 80);
  const torusMesh = new THREE.Mesh(
    torusGeo,
    new THREE.MeshStandardMaterial({
      color: 0xc9a84c,
      metalness: 0.9,
      roughness: 0.1,
      transparent: true,
      opacity: 0.6,
    }),
  );
  torusMesh.rotation.x = Math.PI / 3;
  torusMesh.position.set(0.5, 0, 0);
  scene.add(torusMesh);
  shapes.push({
    mesh: torusMesh,
    rotX: 0.002,
    rotY: 0.004,
    floatAmp: 0.1,
    floatFreq: 0.5,
    baseY: 0,
  });

  // Outer ring
  const ring2 = new THREE.Mesh(
    new THREE.TorusGeometry(4.8, 0.03, 6, 100),
    new THREE.MeshBasicMaterial({
      color: 0xc9a84c,
      transparent: true,
      opacity: 0.12,
    }),
  );
  ring2.rotation.x = Math.PI / 2.5;
  ring2.rotation.y = Math.PI / 5;
  ring2.position.set(0.5, 0, 0);
  scene.add(ring2);
  shapes.push({
    mesh: ring2,
    rotX: -0.001,
    rotY: 0.003,
    floatAmp: 0.08,
    floatFreq: 0.4,
    baseY: 0,
  });

  // Small satellite octahedra
  const smallShapePositions = [
    { pos: [-5.5, 2, -2], scale: 0.5, mat: darkGoldMaterial },
    { pos: [6, -1.5, -3], scale: 0.65, mat: glassMaterial },
    { pos: [-4, -3, -1], scale: 0.4, mat: goldMaterial },
    { pos: [5.5, 3, -1], scale: 0.35, mat: wireMaterial },
    { pos: [0, 4.5, -3], scale: 0.45, mat: darkGoldMaterial },
    { pos: [-6, 0.5, -4], scale: 0.3, mat: glassMaterial },
  ];
  smallShapePositions.forEach((s, i) => {
    const geo =
      i % 2 === 0
        ? new THREE.OctahedronGeometry(1, 0)
        : new THREE.TetrahedronGeometry(1, 0);
    const mesh = new THREE.Mesh(geo, s.mat);
    mesh.position.set(...s.pos);
    mesh.scale.setScalar(s.scale);
    scene.add(mesh);
    shapes.push({
      mesh,
      rotX: (Math.random() - 0.5) * 0.01,
      rotY: (Math.random() - 0.5) * 0.01,
      floatAmp: 0.2 + Math.random() * 0.3,
      floatFreq: 0.4 + Math.random() * 0.6,
      baseY: s.pos[1],
      phaseOffset: i * 0.8,
    });
  });

  /* ── Particle Field ───────────────────────────────── */
  let activeParticleCount = getHeroSceneRuntimeConfig().particleCount;
  const positions = new Float32Array(HERO_SCENE_MAX_PARTICLE_COUNT * 3);
  const particleSpeeds = [];
  for (let i = 0; i < HERO_SCENE_MAX_PARTICLE_COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 30;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 15 - 5;
    particleSpeeds.push({
      x: (Math.random() - 0.5) * 0.002,
      y: (Math.random() - 0.5) * 0.002,
    });
  }
  const partGeo = new THREE.BufferGeometry();
  partGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  partGeo.setDrawRange(0, activeParticleCount);
  const partMat = new THREE.PointsMaterial({
    color: 0xd4a843,
    size: 0.06,
    transparent: true,
    opacity: 0.55,
    sizeAttenuation: true,
  });
  const particles = new THREE.Points(partGeo, partMat);
  scene.add(particles);

  /* ── Mouse Parallax ───────────────────────────────── */
  let mouseX = 0,
    mouseY = 0;
  let targetX = 0,
    targetY = 0;
  document.addEventListener("mousemove", (e) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = -(e.clientY / window.innerHeight - 0.5) * 2;
  });

  /* ── Scroll parallax ─────────────────────────────── */
  let scrollY = 0;
  window.addEventListener("scroll", () => {
    scrollY = window.scrollY;
  });

  /* ── Resize ───────────────────────────────────────── */
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  /* ── Animation Loop ───────────────────────────────── */
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();
    const sceneConfig = getHeroSceneRuntimeConfig();
    const sceneEnabled = sceneConfig.enabled !== false;

    renderer.toneMappingExposure = sceneConfig.toneMappingExposure;
    ambientLight.intensity = sceneConfig.ambientLightIntensity;
    goldLight.intensity = sceneConfig.goldLightIntensity;
    warmLight.intensity = sceneConfig.warmLightIntensity;
    rimLight.intensity = sceneConfig.rimLightIntensity;
    camera.position.z = sceneConfig.cameraDistance;
    canvas.style.opacity = sceneEnabled ? "1" : "0";

    if (activeParticleCount !== sceneConfig.particleCount) {
      activeParticleCount = sceneConfig.particleCount;
      partGeo.setDrawRange(0, activeParticleCount);
    }

    if (heroSection) {
      heroSection.dataset.heroScenePreset = sceneConfig.preset;
      heroSection.dataset.heroSceneEnabled = sceneEnabled ? "true" : "false";
    }

    if (!sceneEnabled) {
      renderer.clear();
      return;
    }

    // Smooth mouse follow
    targetX += (mouseX - targetX) * 0.04;
    targetY += (mouseY - targetY) * 0.04;

    // Camera subtle movement
    camera.position.x = targetX * 0.8;
    camera.position.y = targetY * 0.5 - scrollY * 0.002;
    camera.lookAt(0.5, 0, 0);

    // Animate shapes
    shapes.forEach((s, i) => {
      s.mesh.rotation.x += s.rotX;
      s.mesh.rotation.y += s.rotY;
      const phase = s.phaseOffset || 0;
      s.mesh.position.y =
        s.baseY + Math.sin(elapsed * s.floatFreq + phase) * s.floatAmp;
    });

    // Animate gold light orbit
    goldLight.position.x = Math.cos(elapsed * 0.5) * 8;
    goldLight.position.z = Math.sin(elapsed * 0.5) * 6 + 4;
    goldLight.position.y = Math.sin(elapsed * 0.3) * 3 + 3;

    // Particle drift
    const posAttr = partGeo.attributes.position;
    for (let i = 0; i < activeParticleCount; i++) {
      posAttr.array[i * 3] += particleSpeeds[i].x;
      posAttr.array[i * 3 + 1] += particleSpeeds[i].y;
      // Wrap
      if (posAttr.array[i * 3] > 15) posAttr.array[i * 3] = -15;
      if (posAttr.array[i * 3] < -15) posAttr.array[i * 3] = 15;
      if (posAttr.array[i * 3 + 1] > 10) posAttr.array[i * 3 + 1] = -10;
      if (posAttr.array[i * 3 + 1] < -10) posAttr.array[i * 3 + 1] = 10;
    }
    posAttr.needsUpdate = true;

    // Pulsing main shape
    const pulse = 1 + Math.sin(elapsed * 1.2) * 0.02;
    icosaMesh.scale.setScalar(pulse);
    icosaWire.scale.setScalar(pulse * 1.02);

    renderer.render(scene, camera);
  }

  animate();
})();

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface BscThreeCanvasProps {
  scrollY?: number;
}

export default function BscThreeCanvas({ scrollY = 0 }: BscThreeCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef(scrollY);
  scrollRef.current = scrollY;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check device capability
    const isMobile = window.innerWidth < 768;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Set up Three.js Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 24;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: !isMobile, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1 : 1.75));
    container.appendChild(renderer.domElement);

    // Ambient & Point Lighting for luxury textile gold sheen
    const ambientLight = new THREE.AmbientLight(0xfff5ea, 0.8);
    scene.add(ambientLight);

    const goldLight = new THREE.PointLight(0xe8c7a8, 2.2, 50);
    goldLight.position.set(10, 10, 15);
    scene.add(goldLight);

    const plumLight = new THREE.PointLight(0xb76e79, 1.6, 40);
    plumLight.position.set(-10, -10, 10);
    scene.add(plumLight);

    // 1. Floating Gold & Silk Thread Particles
    const particleCount = isMobile ? 60 : 320;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const goldPalette = [
      new THREE.Color(0xb88d42), // Antique Gold
      new THREE.Color(0xe8c7a8), // Champagne
      new THREE.Color(0xb76e79), // Rose Gold
      new THREE.Color(0xf7f2e9)  // Soft Ivory
    ];

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 40;

      const col = goldPalette[Math.floor(Math.random() * goldPalette.length)];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: isMobile ? 0.35 : 0.45,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // 2. Subtle Floating Silk Wave Plane
    const planeGeo = new THREE.PlaneGeometry(36, 26, isMobile ? 10 : 28, isMobile ? 10 : 28);
    const planeMat = new THREE.MeshStandardMaterial({
      color: 0x24141d,
      roughness: 0.6,
      metalness: 0.4,
      wireframe: true,
      transparent: true,
      opacity: 0.12
    });
    const silkWave = new THREE.Mesh(planeGeo, planeMat);
    silkWave.rotation.x = -Math.PI / 4;
    silkWave.position.z = -5;
    scene.add(silkWave);

    // Mouse Parallax Trackers
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const onMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    // Window Resize Handler
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    // Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (document.hidden) return;

      if (prefersReducedMotion) {
        renderer.render(scene, camera);
        return;
      }

      const elapsed = clock.getElapsedTime();

      // Smooth mouse lerp
      targetX += (mouseX - targetX) * 0.05;
      targetY += (mouseY - targetY) * 0.05;

      // Real 3D Camera depth based on document scroll
      const normalizedScroll = (scrollRef.current || 0) * 0.008;
      camera.position.z = 24 - normalizedScroll * 0.2;
      camera.position.x = targetX * 1.5;
      camera.position.y = -targetY * 1.5 - normalizedScroll * 0.4;
      camera.lookAt(0, -normalizedScroll * 0.4, 0);

      // Rotate particle cloud gently
      particles.rotation.y = elapsed * 0.03;
      particles.rotation.x = elapsed * 0.015;

      // Silk wave ripple
      const posAttr = planeGeo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const u = posAttr.getX(i);
        const v = posAttr.getY(i);
        const z = Math.sin(u * 0.3 + elapsed * 1.2) * 0.8 + Math.cos(v * 0.3 + elapsed * 0.9) * 0.6;
        posAttr.setZ(i, z);
      }
      posAttr.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      planeGeo.dispose();
      planeMat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none z-[1] overflow-hidden"
      aria-hidden="true"
    />
  );
}

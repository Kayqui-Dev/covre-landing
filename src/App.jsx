import React, { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger, useGSAP);

const sceneConfigs = [
  { id: 'cena1', name: 'Cena 1 (Elevador)', count: 192 },
  { id: 'cena2', name: 'Cena 2 (Embalagem)', count: 240 },
  { id: 'cena3', name: 'Cena 3 (Transporte)', count: 240 },
  { id: 'cena4', name: 'Cena 4 (Caminhão)', count: 240 }
];

export default function App() {
  const containerRef = useRef(null);
  const stackRef = useRef(null);
  
  // Refs for each canvas
  const canvasRefs = {
    cena1: useRef(null),
    cena2: useRef(null),
    cena3: useRef(null),
    cena4: useRef(null)
  };

  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [sceneImages, setSceneImages] = useState({
    cena1: [],
    cena2: [],
    cena3: [],
    cena4: []
  });

  // Track current frame indexes for resize redraws
  const currentFramesRef = useRef({
    cena1: 0,
    cena2: 0,
    cena3: 0,
    cena4: 0
  });

  // 1. Preload AVIF frame sequences for all scenes in parallel
  useEffect(() => {
    let active = true;

    // Flatten all frames to load
    const allFrames = [];
    sceneConfigs.forEach((scene) => {
      for (let i = 1; i <= scene.count; i++) {
        allFrames.push({
          sceneId: scene.id,
          index: i - 1,
          url: `/frames/${scene.id}/frame_${String(i).padStart(4, '0')}.avif`
        });
      }
    });

    const tempImages = {
      cena1: [],
      cena2: [],
      cena3: [],
      cena4: []
    };

    let completed = 0;
    const total = allFrames.length;

    allFrames.forEach((frame) => {
      const img = new Image();
      img.fetchPriority = 'high';
      
      img.onload = () => {
        if (!active) return;
        tempImages[frame.sceneId][frame.index] = img;
        completed++;
        setLoadProgress(Math.round((completed / total) * 100));
        
        if (completed === total) {
          setSceneImages(tempImages);
          setLoading(false);
        }
      };

      img.onerror = () => {
        if (!active) return;
        completed++;
        setLoadProgress(Math.round((completed / total) * 100));
        
        if (completed === total) {
          setSceneImages(tempImages);
          setLoading(false);
        }
      };

      img.src = frame.url;
    });

    return () => {
      active = false;
    };
  }, []);

  // Draw image inside canvas stretching it (and cropping bottom to remove watermark)
  const drawImageFit = (ctx, img, canvas) => {
    if (!img) return;
    const cw = canvas.width;
    const ch = canvas.height;
    ctx.clearRect(0, 0, cw, ch);
    
    // Crop 48px from the bottom to completely remove the "Veo" watermark
    const cropBottom = 48;
    ctx.drawImage(img, 0, 0, img.width, img.height - cropBottom, 0, 0, cw, ch);
  };

  // Render a specific frame on a scene canvas
  const renderFrame = (sceneId, index) => {
    const canvas = canvasRefs[sceneId].current;
    const images = sceneImages[sceneId];
    if (!canvas || !images || images.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgIndex = Math.min(Math.max(index, 0), images.length - 1);
    const img = images[imgIndex];

    drawImageFit(ctx, img, canvas);
    currentFramesRef.current[sceneId] = imgIndex;
  };

  // Setup canvas sizes on resize (crisp resolution)
  const handleResize = () => {
    sceneConfigs.forEach((scene) => {
      const canvas = canvasRefs[scene.id].current;
      if (!canvas) return;

      const dpr = window.devicePixelRatio || 1;
      
      // Use client bounds (which are locked to 16:9 in CSS)
      const rect = canvas.getBoundingClientRect();
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      // Re-draw current frame
      const currentIdx = currentFramesRef.current[scene.id];
      renderFrame(scene.id, currentIdx);
    });
  };

  // Bind resize event and draw initial frames
  useEffect(() => {
    if (loading) return;

    window.addEventListener('resize', handleResize);
    handleResize();

    // Draw frame 0 on all canvases initially
    sceneConfigs.forEach((scene) => {
      renderFrame(scene.id, 0);
    });

    return () => window.removeEventListener('resize', handleResize);
  }, [loading, sceneImages]);

  // 2. GSAP ScrollTrigger timeline orchestration for vertical floor stack navigation
  useGSAP(() => {
    if (loading) return;

    // Virtual object to animate frames
    const animationState = {
      frame1: 0,
      frame2: 0,
      frame3: 0,
      frame4: 0
    };

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.5,
      }
    });

    // Orquestrate scrubbing and translations
    tl
      // 1. Play Scene 1
      .to(animationState, {
        frame1: sceneConfigs[0].count - 1,
        ease: 'none',
        duration: 1.5,
        onUpdate: () => renderFrame('cena1', Math.floor(animationState.frame1))
      })
      // 2. Move camera to Scene 2 (pan down)
      .to(stackRef.current, {
        yPercent: -100,
        ease: 'power2.inOut',
        duration: 1.0
      })
      // 3. Play Scene 2
      .to(animationState, {
        frame2: sceneConfigs[1].count - 1,
        ease: 'none',
        duration: 1.5,
        onUpdate: () => renderFrame('cena2', Math.floor(animationState.frame2))
      })
      // 4. Move camera to Scene 3
      .to(stackRef.current, {
        yPercent: -200,
        ease: 'power2.inOut',
        duration: 1.0
      })
      // 5. Play Scene 3
      .to(animationState, {
        frame3: sceneConfigs[2].count - 1,
        ease: 'none',
        duration: 1.5,
        onUpdate: () => renderFrame('cena3', Math.floor(animationState.frame3))
      })
      // 6. Move camera to Scene 4
      .to(stackRef.current, {
        yPercent: -300,
        ease: 'power2.inOut',
        duration: 1.0
      })
      // 7. Play Scene 4
      .to(animationState, {
        frame4: sceneConfigs[3].count - 1,
        ease: 'none',
        duration: 1.5,
        onUpdate: () => renderFrame('cena4', Math.floor(animationState.frame4))
      });

  }, { dependencies: [loading, sceneImages], scope: containerRef });

  return (
    <div className="relative min-h-screen bg-[#050508] select-none overflow-x-hidden">
      
      {/* 1. LOADING SCREEN */}
      {loading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-brand-dark telemetry-grid p-6">
          <div className="absolute top-8 left-8 flex items-center space-x-3">
            <span className="text-xl font-bold tracking-widest text-brand-primary">COVRE</span>
            <div className="h-[1px] w-12 bg-zinc-800"></div>
            <span className="technical-text text-zinc-500 text-[10px]">INIT_SYS_LOAD</span>
          </div>

          <div className="w-full max-w-lg glass-panel p-8 rounded-lg relative overflow-hidden">
            <h2 className="text-xl font-bold tracking-tight text-white mb-2 uppercase">
              Carregando Armazém
            </h2>
            <div className="relative h-[2px] w-full bg-zinc-800 rounded-full overflow-hidden mb-3">
              <div 
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-brand-primary to-brand-secondary transition-all duration-300 ease-out"
                style={{ width: `${loadProgress}%` }}
              ></div>
            </div>
            <div className="flex justify-between items-center font-technical text-[10px] text-zinc-500">
              <span>LOADING FRAMES SEQUENCE</span>
              <span className="text-brand-primary font-bold">{loadProgress}%</span>
            </div>
          </div>

          <div className="absolute bottom-8 text-center font-technical text-[10px] text-zinc-600 tracking-widest">
            COVRE SYSTEMS INT.
          </div>
        </div>
      )}

      {/* 2. PERSISTENT FIXED VIEWPORT WINDOW */}
      {!loading && (
        <div className="viewport-wrapper">
          <div className="canvas-window">
            <div ref={stackRef} className="floor-stack">
              {sceneConfigs.map((scene) => (
                <div key={scene.id} className="floor-item">
                  <canvas 
                    ref={canvasRefs[scene.id]} 
                    className="canvas-16-9"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. SCROLL TRACK (Gives length to the page scroll) */}
      <div ref={containerRef} className="relative z-10 w-full h-[800vh] pointer-events-none"></div>

    </div>
  );
}

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'url';
import { fileURLToPath } from 'url';
import pathLib from 'path';

// Resolving __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = pathLib.dirname(__filename);

// Project root path
const rootDir = pathLib.resolve(__dirname, '..');
const tempDir = pathLib.join(rootDir, 'temp_frames');
const outputDir = pathLib.join(rootDir, 'public', 'frames');

// Config
const scenes = [
  { folderName: 'cena1', name: 'Cena 1 (Elevador)', path: '/Users/kayqui/Downloads/projeto covre/video cena 1.mp4' },
  { folderName: 'cena2', name: 'Cena 2 (Embalagem)', path: '/Users/kayqui/Downloads/projeto covre/video cena 2.mp4' },
  { folderName: 'cena3', name: 'Cena 3 (Transporte)', path: '/Users/kayqui/Downloads/projeto covre/video cena 3.mp4' },
  { folderName: 'cena4', name: 'Cena 4 (Caminhão)', path: '/Users/kayqui/Downloads/projeto covre/video cena 4.mp4' }
];

const FPS = 24; // Target frame rate
const AVIF_QUALITY = 60; // 1-100 (60 is excellent balance of weight vs quality)
const TARGET_WIDTH = 1920; // Resolution width (1920x1080)
const TARGET_HEIGHT = 1080;
const CONCURRENCY = 8; // Number of parallel conversions

// Dynamic import of sharp since it's installed locally
let sharp;

// Simple parallel worker pool to leverage multi-core Mac CPU
async function runParallel(tasks, concurrency, workerFn) {
  let index = 0;
  
  async function worker() {
    while (index < tasks.length) {
      const currentIndex = index++;
      const task = tasks[currentIndex];
      try {
        await workerFn(task, currentIndex);
      } catch (err) {
        console.error(`❌ Erro no processamento do index ${currentIndex}:`, err.message);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
}

async function run() {
  try {
    const sharpModule = await import('sharp');
    sharp = sharpModule.default;
  } catch (err) {
    console.error('❌ Erro ao carregar "sharp". Certifique-se de executar "npm install sharp" antes.');
    process.exit(1);
  }

  console.log('⚡ Iniciando o processamento dos vídeos da Covre divididos em pastas de cena...');
  console.log(`💻 Utilizando concorrência de: ${CONCURRENCY} threads.`);

  // Clean / Create temp directory
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  // Clean public/frames parent directory
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outputDir, { recursive: true });

  for (let s = 0; s < scenes.length; s++) {
    const scene = scenes[s];
    console.log(`\n🎬 Extraindo [${scene.name}]...`);
    
    if (!fs.existsSync(scene.path)) {
      console.error(`❌ Arquivo de vídeo não encontrado em: ${scene.path}`);
      continue;
    }

    const sceneTempDir = pathLib.join(tempDir, `scene_${s + 1}`);
    fs.mkdirSync(sceneTempDir, { recursive: true });

    const sceneOutputDir = pathLib.join(outputDir, scene.folderName);
    fs.mkdirSync(sceneOutputDir, { recursive: true });

    // Step 1: Extract frames from MP4 using FFmpeg as high-quality JPEGs
    console.log(`  🎥 Extraindo frames a ${FPS} FPS...`);
    try {
      execSync(
        `ffmpeg -y -i "${scene.path}" -vf "fps=${FPS},scale=${TARGET_WIDTH}:${TARGET_HEIGHT}" -q:v 2 "${sceneTempDir}/frame_%04d.jpg"`,
        { stdio: 'pipe' }
      );
    } catch (err) {
      console.error(`❌ Erro ao rodar FFmpeg na cena ${s + 1}:`, err.message);
      continue;
    }

    // Step 2: Read extracted files in order and convert to AVIF using sharp
    const files = fs.readdirSync(sceneTempDir)
      .filter(f => f.endsWith('.jpg'))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)[0], 10);
        const numB = parseInt(b.match(/\d+/)[0], 10);
        return numA - numB;
      });

    console.log(`  🖼️  Convertendo ${files.length} frames para AVIF na pasta /public/frames/${scene.folderName}/...`);
    
    // Use our parallel pool
    await runParallel(files, CONCURRENCY, async (file, index) => {
      const inputPath = pathLib.join(sceneTempDir, file);
      
      // Frame index starts at 1 for EACH scene
      const frameIndex = index + 1;
      const frameName = `frame_${String(frameIndex).padStart(4, '0')}.avif`;
      const outputPath = pathLib.join(sceneOutputDir, frameName);

      await sharp(inputPath)
        .avif({
          quality: AVIF_QUALITY,
          effort: 3, 
          chromaSubsampling: '4:2:0'
        })
        .toFile(outputPath);
      
      const completed = index + 1;
      if (completed % 50 === 0 || completed === files.length) {
        console.log(`    ⏳ [${scene.name}] Convertidos: ${completed}/${files.length} frames...`);
      }
    });

    console.log(`  ✅ ${scene.name} concluída. Salvos ${files.length} frames em /public/frames/${scene.folderName}/`);
  }

  // Clean up temp frames
  console.log('\n🧹 Limpando arquivos temporários...');
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  console.log(`\n🎉 Processamento completo de todas as pastas de cena!`);
}

run();

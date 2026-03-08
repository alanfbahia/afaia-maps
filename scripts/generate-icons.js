#!/usr/bin/env node
// ============================================================
//  scripts/generate-icons.js
//  Gera todos os ícones e splash screens necessários para:
//  - PWA (manifest.json)
//  - Capacitor Android/iOS
//  - Apple Touch Icons
//
//  Dependências: npm install sharp
//  Uso: node scripts/generate-icons.js
// ============================================================
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Verificar se sharp está disponível
let sharp;
try {
  const mod = await import('sharp');
  sharp = mod.default;
} catch {
  console.error('\n❌ Dependência "sharp" não encontrada.');
  console.error('   Instale com: npm install sharp');
  console.error('   Depois execute: node scripts/generate-icons.js\n');
  process.exit(1);
}

// ── Configurações ─────────────────────────────────────────
const SOURCE_ICON        = join(ROOT, 'frontend/icons/icon.svg');
const SOURCE_MASKABLE    = join(ROOT, 'frontend/icons/icon-maskable.svg');
const ICONS_DIR          = join(ROOT, 'frontend/icons');
const SPLASH_DIR         = join(ROOT, 'frontend/splash');
const CAP_ANDROID_DIR    = join(ROOT, 'android/app/src/main/res');
const CAP_IOS_DIR        = join(ROOT, 'ios/App/App/Assets.xcassets/AppIcon.appiconset');

// ── Tamanhos dos ícones PWA ───────────────────────────────
const PWA_SIZES = [48, 72, 96, 128, 144, 152, 192, 256, 512];

// ── Tamanhos Android (mipmap) ────────────────────────────
const ANDROID_ICONS = [
  { size: 36,  dir: 'mipmap-ldpi'    },
  { size: 48,  dir: 'mipmap-mdpi'    },
  { size: 72,  dir: 'mipmap-hdpi'    },
  { size: 96,  dir: 'mipmap-xhdpi'   },
  { size: 144, dir: 'mipmap-xxhdpi'  },
  { size: 192, dir: 'mipmap-xxxhdpi' },
];

// ── Splash screens (portrait) ─────────────────────────────
const SPLASH_SIZES = [
  { w: 640,  h: 1136, name: 'splash-640x1136.png'  }, // iPhone SE
  { w: 750,  h: 1334, name: 'splash-750x1334.png'  }, // iPhone 8
  { w: 828,  h: 1792, name: 'splash-828x1792.png'  }, // iPhone XR
  { w: 1080, h: 1920, name: 'splash-1080x1920.png' }, // Android HD
  { w: 1125, h: 2436, name: 'splash-1125x2436.png' }, // iPhone X
  { w: 1170, h: 2532, name: 'splash-1170x2532.png' }, // iPhone 12
  { w: 1242, h: 2208, name: 'splash-1242x2208.png' }, // iPhone 8 Plus
  { w: 1242, h: 2688, name: 'splash-1242x2688.png' }, // iPhone XS Max
  { w: 1284, h: 2778, name: 'splash-1284x2778.png' }, // iPhone 12 Pro Max
  { w: 1536, h: 2048, name: 'splash-1536x2048.png' }, // iPad
  { w: 2048, h: 2732, name: 'splash-2048x2732.png' }, // iPad Pro 12.9
];

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

async function generatePWAIcons() {
  console.log('\n📱 Gerando ícones PWA...');
  ensureDir(ICONS_DIR);

  for (const size of PWA_SIZES) {
    const outPath = join(ICONS_DIR, `icon-${size}.png`);
    await sharp(SOURCE_ICON)
      .resize(size, size)
      .png({ quality: 95 })
      .toFile(outPath);
    console.log(`  ✅ icon-${size}.png`);
  }

  // Maskable icons
  for (const size of [192, 512]) {
    const outPath = join(ICONS_DIR, `icon-maskable-${size}.png`);
    await sharp(SOURCE_MASKABLE)
      .resize(size, size)
      .png({ quality: 95 })
      .toFile(outPath);
    console.log(`  ✅ icon-maskable-${size}.png`);
  }

  // Apple touch icon (180x180)
  await sharp(SOURCE_ICON)
    .resize(180, 180)
    .png({ quality: 95 })
    .toFile(join(ICONS_DIR, 'apple-touch-icon.png'));
  console.log('  ✅ apple-touch-icon.png');

  // Favicon 32x32
  await sharp(SOURCE_ICON)
    .resize(32, 32)
    .png({ quality: 95 })
    .toFile(join(ICONS_DIR, 'favicon-32.png'));
  console.log('  ✅ favicon-32.png');

  // Shortcut icons
  for (const name of ['shortcut-pin', 'shortcut-track', 'shortcut-maps']) {
    await sharp(SOURCE_ICON)
      .resize(96, 96)
      .png({ quality: 90 })
      .toFile(join(ICONS_DIR, `${name}.png`));
    console.log(`  ✅ ${name}.png`);
  }
}

async function generateSplashScreens() {
  console.log('\n🖼️  Gerando splash screens...');
  ensureDir(SPLASH_DIR);

  for (const { w, h, name } of SPLASH_SIZES) {
    const iconSize = Math.round(Math.min(w, h) * 0.3);
    const iconBuffer = await sharp(SOURCE_ICON)
      .resize(iconSize, iconSize)
      .png()
      .toBuffer();

    await sharp({
      create: {
        width:      w,
        height:     h,
        channels:   4,
        background: { r: 15, g: 23, b: 42, alpha: 1 }, // #0f172a
      }
    })
      .composite([{
        input:   iconBuffer,
        gravity: 'centre',
      }])
      .png({ quality: 90 })
      .toFile(join(SPLASH_DIR, name));

    console.log(`  ✅ ${name} (${w}×${h})`);
  }
}

async function generateAndroidIcons() {
  if (!existsSync(join(ROOT, 'android'))) {
    console.log('\n⚠️  Pasta android/ não encontrada. Execute npx cap add android primeiro.');
    return;
  }

  console.log('\n🤖 Gerando ícones Android...');
  for (const { size, dir } of ANDROID_ICONS) {
    const outDir = join(CAP_ANDROID_DIR, dir);
    ensureDir(outDir);

    await sharp(SOURCE_ICON)
      .resize(size, size)
      .png()
      .toFile(join(outDir, 'ic_launcher.png'));

    await sharp(SOURCE_MASKABLE)
      .resize(size, size)
      .png()
      .toFile(join(outDir, 'ic_launcher_round.png'));

    await sharp(SOURCE_MASKABLE)
      .resize(size, size)
      .png()
      .toFile(join(outDir, 'ic_launcher_foreground.png'));

    console.log(`  ✅ ${dir}/ic_launcher.png (${size}px)`);
  }

  // Splash screen Android (9-patch placeholder)
  const androidSplashDir = join(CAP_ANDROID_DIR, 'drawable');
  ensureDir(androidSplashDir);
  await sharp({
    create: { width: 480, height: 800, channels: 4, background: { r: 15, g: 23, b: 42, alpha: 1 } }
  })
    .composite([{
      input: await sharp(SOURCE_ICON).resize(160, 160).png().toBuffer(),
      gravity: 'centre',
    }])
    .png()
    .toFile(join(androidSplashDir, 'splash.png'));
  console.log('  ✅ drawable/splash.png');
}

async function generateiOSIcons() {
  if (!existsSync(join(ROOT, 'ios'))) {
    console.log('\n⚠️  Pasta ios/ não encontrada. Execute npx cap add ios primeiro.');
    return;
  }

  console.log('\n🍎 Gerando ícones iOS...');
  const iosSizes = [
    20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024
  ];

  ensureDir(CAP_IOS_DIR);

  for (const size of iosSizes) {
    await sharp(SOURCE_ICON)
      .resize(size, size)
      .png({ quality: 95 })
      .toFile(join(CAP_IOS_DIR, `AppIcon-${size}@1x.png`));
    console.log(`  ✅ AppIcon-${size}@1x.png`);
  }
}

// ── Main ──────────────────────────────────────────────────
console.log('🗺️  Afaia Maps – Gerador de Ícones e Splash Screens');
console.log('='.repeat(50));

try {
  await generatePWAIcons();
  await generateSplashScreens();
  await generateAndroidIcons();
  await generateiOSIcons();

  console.log('\n✅ Todos os assets gerados com sucesso!');
  console.log('\nPróximos passos:');
  console.log('  1. Execute: npx cap sync');
  console.log('  2. Abra o Android Studio: npx cap open android');
  console.log('  3. Abra o Xcode: npx cap open ios\n');
} catch (err) {
  console.error('\n❌ Erro durante geração:', err.message);
  process.exit(1);
}

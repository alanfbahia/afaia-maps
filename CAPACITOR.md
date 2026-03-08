# 📱 Afaia Maps – Guia Capacitor (Android + iOS)

> Transforme o frontend web do Afaia Maps em app nativo Android e iPhone usando **Capacitor 6**.

---

## 📋 Índice
1. [Pré-requisitos](#pré-requisitos)
2. [Instalação inicial](#instalação-inicial)
3. [Gerar ícones e splash screens](#ícones-e-splash-screens)
4. [Build Android](#build-android)
5. [Build iOS](#build-ios)
6. [Permissões](#permissões)
7. [Publicar na Google Play](#google-play)
8. [Publicar na App Store](#app-store)
9. [Plugins utilizados](#plugins)
10. [Desenvolvimento e debug](#debug)
11. [Troubleshooting](#troubleshooting)

---

## Pré-requisitos

### Todos os sistemas
```bash
node --version    # >= 18
npm  --version    # >= 9
java --version    # >= 17 (para Android)
```

### Para Android
| Requisito | Versão | Download |
|---|---|---|
| **Android Studio** | Hedgehog+ | [developer.android.com/studio](https://developer.android.com/studio) |
| **JDK** | 17+ | Incluído no Android Studio |
| **Android SDK** | API 24+ (Android 7.0) | Via Android Studio SDK Manager |
| **Gradle** | Auto (gerenciado) | — |

### Para iOS (macOS obrigatório)
| Requisito | Versão | Download |
|---|---|---|
| **macOS** | 13 Ventura+ | — |
| **Xcode** | 15+ | App Store |
| **CocoaPods** | 1.14+ | `sudo gem install cocoapods` |
| **ios-deploy** | — | `brew install ios-deploy` |

---

## Instalação inicial

### 1. Instale as dependências
```bash
# Na raiz do projeto (onde está o package.json do Capacitor)
npm install
```

### 2. Inicialize o Capacitor
```bash
npx cap init "Afaia Maps" com.afaiamaps.app --web-dir frontend
```

### 3. Adicione as plataformas
```bash
# Android
npx cap add android

# iOS (apenas no macOS)
npx cap add ios
```

### 4. Copie os arquivos de configuração de permissões

**Android:**
```bash
# Substitua o AndroidManifest.xml gerado:
cp android-config/AndroidManifest.xml android/app/src/main/AndroidManifest.xml
```

**iOS:**
```bash
# Mescle as entradas do Info.plist:
# Os blocos em ios-config/Info.plist devem ser adicionados ao
# arquivo gerado em: ios/App/App/Info.plist
```

### 5. Sincronize
```bash
npx cap sync
```

---

## Ícones e Splash Screens

### Opção A – Usar o capacitor-assets (recomendado)

1. Coloque seus arquivos na raiz do projeto:
   - `icon.png` – **1024×1024px**, fundo sólido, sem transparência
   - `icon-foreground.png` – 1024×1024px, ícone foreground (adaptive icon Android)
   - `icon-background.png` – 1024×1024px, cor de fundo
   - `splash.png` – **2732×2732px**, logo centralizado

2. Execute:
```bash
npx capacitor-assets generate
```

Isso gera **automaticamente** todos os tamanhos para Android e iOS. ✅

### Opção B – SVG placeholders (desenvolvimento)
```bash
node scripts/generate-icons.js
```
Gera ícones SVG em `frontend/icons/` e `frontend/splash/` para testes.

### Tamanhos necessários

**Android:**
| Densidade | Tamanho | Pasta |
|---|---|---|
| mdpi   | 48×48   | `mipmap-mdpi` |
| hdpi   | 72×72   | `mipmap-hdpi` |
| xhdpi  | 96×96   | `mipmap-xhdpi` |
| xxhdpi | 144×144 | `mipmap-xxhdpi` |
| xxxhdpi| 192×192 | `mipmap-xxxhdpi` |

**iOS:**
| Uso | Tamanho |
|---|---|
| iPhone app icon | 60×60 @2x, @3x |
| iPad app icon   | 76×76 @1x, @2x |
| App Store       | 1024×1024 @1x |

---

## Build Android

### Desenvolvimento (debug)
```bash
# Sincroniza e abre no Android Studio
npm run android
# OU
npx cap sync && npx cap open android

# No Android Studio: Run → Run 'app' (ou Shift+F10)
```

### Produção (release AAB para Google Play)

#### 1. Gere a keystore (apenas uma vez!)
```bash
keytool -genkey -v \
  -keystore android/app/afaia-release.keystore \
  -alias afaia-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```
> ⚠️ **Guarde a keystore e as senhas com segurança!** Sem elas, você não pode atualizar o app.

#### 2. Configure o build.gradle
Em `android/app/build.gradle`, adicione:
```groovy
android {
    ...
    signingConfigs {
        release {
            storeFile     file('afaia-release.keystore')
            storePassword System.getenv('KEYSTORE_PASS') ?: 'SUA_SENHA'
            keyAlias      'afaia-key'
            keyPassword   System.getenv('KEY_PASS')      ?: 'SUA_SENHA'
        }
    }
    buildTypes {
        release {
            signingConfig          signingConfigs.release
            minifyEnabled          true
            shrinkResources        true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

#### 3. Gere o AAB
```bash
cd android
./gradlew bundleRelease
# AAB gerado em: android/app/build/outputs/bundle/release/app-release.aab
```

#### 4. Ou gere APK para testes
```bash
cd android
./gradlew assembleRelease
# APK em: android/app/build/outputs/apk/release/app-release.apk
```

### Configuração mínima do `build.gradle`
```groovy
defaultConfig {
    applicationId "com.afaiamaps.app"
    minSdkVersion    24    // Android 7.0
    targetSdkVersion 34    // Android 14
    versionCode      1
    versionName      "1.0.0"
}
```

---

## Build iOS

### Desenvolvimento (simulador/device)
```bash
# Sincroniza e abre no Xcode
npm run ios
# OU
npx cap sync && npx cap open ios

# No Xcode: selecione o simulador ou device → ▶ Run
```

### Produção (para App Store)

#### 1. Configure o Bundle ID no Xcode
- `TARGETS → App → Signing & Capabilities`
- Bundle Identifier: `com.afaiamaps.app`
- Team: sua Apple Developer Account

#### 2. Configure versão e build
```
Version: 1.0.0
Build:   1
```

#### 3. Archive para distribuição
```
Product → Archive → Distribute App → App Store Connect
```

#### 4. Ou via linha de comando
```bash
cd ios
xcodebuild -workspace App/App.xcworkspace \
           -scheme App \
           -configuration Release \
           -archivePath build/App.xcarchive \
           archive

xcodebuild -exportArchive \
           -archivePath build/App.xcarchive \
           -exportOptionsPlist ExportOptions.plist \
           -exportPath build/
```

### Configurações iOS importantes
Em `ios/App/App/AppDelegate.swift`, o Capacitor já configura o necessário.

Certifique-se de que `ios/App/App/Info.plist` tem todas as entradas de `ios-config/Info.plist`.

---

## Permissões

### Resumo das permissões solicitadas

| Permissão | Android | iOS | Motivo |
|---|---|---|---|
| **GPS (foreground)** | `ACCESS_FINE_LOCATION` | `NSLocationWhenInUseUsageDescription` | Mostrar posição, waypoints |
| **GPS (background)** | `ACCESS_BACKGROUND_LOCATION` | `NSLocationAlwaysAndWhenInUse...` | Trilhas com tela apagada |
| **Câmera** | `CAMERA` | `NSCameraUsageDescription` | Fotos georreferenciadas |
| **Galeria (leitura)** | `READ_MEDIA_IMAGES` | `NSPhotoLibraryUsageDescription` | Importar fotos |
| **Galeria (escrita)** | (API 28-) | `NSPhotoLibraryAddUsageDescription` | Salvar fotos |
| **Armazenamento** | `READ_EXTERNAL_STORAGE` | `UIFileSharingEnabled` | Importar mapas GPX/KML/PDF |
| **Internet** | `INTERNET` | Automático | API + tiles |
| **Vibração** | `VIBRATE` | Automático | Haptic feedback |
| **Notificações** | `POST_NOTIFICATIONS` | `UNUserNotificationCenter` | Alertas de sync |

### Solicitar permissões no app (JS)

```javascript
// GPS
const granted = await NativeGPS.requestPermission();

// Câmera (solicitada automaticamente ao usar)
const photo = await NativeCamera.takePicture();

// Armazenamento (Android)
import { Filesystem } from '@capacitor/filesystem';
const status = await Filesystem.requestPermissions();
```

### Localização em background (Android)
Para trilhas longas, o Android 10+ exige uma justificativa adicional:

1. No Google Play Console, declare o uso de localização em background
2. Preencha o formulário explicando que é para gravação de trilhas GPS
3. O botão "Sempre permitir" aparece no app em Configurações → Permissões

---

## Google Play

### Pré-requisitos
- Conta Google Play Developer (~$25 taxa única)
- AAB assinado com keystore
- Screenshots (telefone, tablet 7", tablet 10")
- Ícone 512×512px
- Texto descritivo (PT-BR e EN)
- Política de privacidade (URL pública)

### Passos
1. [play.google.com/console](https://play.google.com/console) → **Criar app**
2. Configurar informações do app
3. **Production → Releases → Criar versão** → upload do `.aab`
4. Preencher formulário de declaração de permissões
5. Enviar para revisão (1-3 dias)

### Política de privacidade obrigatória
O app coleta localização GPS → política de privacidade é **obrigatória**.
Crie uma página em `afaiamaps.com/privacidade` explicando:
- Quais dados são coletados (GPS, fotos)
- Como são usados (mapeamento, não vendidos)
- Como o usuário pode excluir os dados

---

## App Store

### Pré-requisitos
- Conta Apple Developer ($99/ano)
- Mac com Xcode 15+
- `.ipa` ou Archive gerado
- Screenshots em resolução exata
- Texto descritivo em PT-BR
- Política de privacidade

### Passos
1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **New App**
2. Bundle ID: `com.afaiamaps.app`
3. SKU: `afaia-maps-ios`
4. **TestFlight** → upload e teste interno
5. **App Store** → Submeter para revisão (1-7 dias)

### Entitlements iOS necessários
Em `ios/App/App/App.entitlements`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" ...>
<plist version="1.0">
<dict>
    <key>com.apple.developer.location.push</key>
    <false/>
    <key>aps-environment</key>
    <string>development</string>
</dict>
</plist>
```

---

## Plugins

### Instalados (package.json)

| Plugin | Uso |
|---|---|
| `@capacitor/geolocation` | GPS nativo com suporte a background |
| `@capacitor/camera` | Câmera e galeria |
| `@capacitor/filesystem` | Leitura/escrita de arquivos |
| `@capacitor/haptics` | Vibração tátil |
| `@capacitor/network` | Status de conexão |
| `@capacitor/status-bar` | Controle da status bar |
| `@capacitor/splash-screen` | Splash screen nativa |
| `@capacitor/keyboard` | Comportamento do teclado |
| `@capacitor/app` | Lifecycle, back button |
| `@capacitor/push-notifications` | Push via FCM/APNs |
| `@capacitor/local-notifications` | Notificações locais |
| `@capacitor/share` | Compartilhar trilhas/mapas |
| `@capacitor/screen-orientation` | Orientação de tela |

### Como usar no JS (via `frontend/js/capacitor.js`)

```javascript
// GPS
const coords = await NativeGPS.getCurrentPosition();

// Câmera + GPS
const photo = await NativeCamera.takePicture();
// photo.lat, photo.lng, photo.dataUrl

// Arquivo
await NativeFS.writeFile('trilha.gpx', gpxContent);

// Haptic
await Haptic.success();   // feedback de confirmação
await Haptic.error();     // feedback de erro

// Compartilhar
await NativeShare.share({ title: 'Minha trilha', url: 'https://...' });

// Plataforma
Platform.isAndroid()  // true em Android nativo
Platform.isIOS()      // true em iPhone/iPad nativo
Platform.isWeb()      // true em PWA/browser
```

---

## Debug

### Android
```bash
# Abre Chrome DevTools para inspecionar a WebView
# No Chrome: chrome://inspect/#devices
# Conecte o celular com USB debug ativado

# Ver logs do app
adb logcat | grep Capacitor
```

### iOS
```bash
# Abre Safari Web Inspector
# Safari → Develop → [seu iPhone] → Afaia Maps

# Ver logs
# Xcode → Debug area (⌘+⇧+Y)
```

### Ativar debug no capacitor.config.json
```json
"android": {
  "webContentsDebuggingEnabled": true
}
```

---

## Troubleshooting

### "GPS não funciona no Android"
1. Verifique se `ACCESS_FINE_LOCATION` está no `AndroidManifest.xml`
2. Solicite a permissão: `await NativeGPS.requestPermission()`
3. No Android 10+: peça `ACCESS_BACKGROUND_LOCATION` separadamente

### "Câmera fecha imediatamente no iOS"
- Verifique se `NSCameraUsageDescription` está no `Info.plist`
- Texto deve ser descritivo e em português

### "App crash na tela de login"
```bash
# Verifique se o webDir aponta para a pasta correta
cat capacitor.config.json | grep webDir
# Deve ser: "frontend"
```

### "npx cap sync falha"
```bash
# Limpe o cache
rm -rf node_modules
npm install
npx cap sync --inline
```

### "Build iOS: pod install falha"
```bash
cd ios/App
pod repo update
pod install --repo-update
```

### "Tela branca no app"
- Verifique se `frontend/index.html` existe e está correto
- No capacitor.config.json, confirme `"webDir": "frontend"`
- No iOS, verifique se o `hostname` está na whitelist de `allowNavigation`

### "TypeError: window.Capacitor is not defined"
- Normal no browser/PWA – o código em `capacitor.js` usa `isCapacitor()` para detectar
- No app nativo, o Capacitor injeta `window.Capacitor` automaticamente

---

## Fluxo de atualização do app

```bash
# 1. Faça alterações nos arquivos em frontend/
# 2. Sincronize com as plataformas nativas
npx cap sync

# 3. Para Android: gere novo AAB e faça upload no Play Console
cd android && ./gradlew bundleRelease

# 4. Para iOS: faça novo Archive no Xcode e envie pelo App Store Connect
```

> Para atualizações apenas de código JS/CSS (sem mudança de plugins ou permissões),
> o app pode ser atualizado **sem passar pela revisão das lojas** usando
> [Capgo](https://capgo.app) (OTA updates para Capacitor).

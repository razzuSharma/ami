# 🌙 AMI — Your AI Companion

AMI is a beautifully designed AI companion app built with **Expo + React Native**.  
It focuses on calm, human-centric interactions through chat and journaling — inspired by modern apps like Instagram, Messenger, and mental-wellbeing tools.

The goal of AMI is simple:  
**a safe space to talk, reflect, and feel heard.**

---

## ✨ Features

- 💬 **Immersive Chat Experience**
  - Smooth keyboard handling
  - Auto-scrolling messages
  - Modern glassmorphism UI
  - AI typing & reply simulation

- 📓 **Journal Mode**
  - Write and reflect in a distraction-free space
  - Calm, minimal design for daily thoughts

- 🎨 **Modern UI / UX**
  - Gradient backgrounds
  - Soft shadows & rounded components
  - Tailwind-style styling (NativeWind)
  - Inspired by Instagram & Facebook chat polish

- 📱 **Cross-Platform**
  - Android
  - iOS
  - Expo Go support

---

## 🛠 Tech Stack

- **Expo**
- **React Native**
- **Expo Router** (file-based routing)
- **NativeWind (Tailwind for React Native)**
- **expo-linear-gradient**
- **@expo/vector-icons**
- **react-native-safe-area-context**

---

## 🚀 Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create `.env.local`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://hogduejzvthobqtdfxbv.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_JWT
EXPO_PUBLIC_COMPANION_FN=companion-chat
```

### 3. Start the app

```bash
npx expo start --clear
```

---

## 📦 Export APK (Android)

AMI uses **EAS Build** for release builds.

### 1. Install and login to EAS

```bash
npm i -g eas-cli
eas login
```

### 2. Configure EAS in this project

```bash
eas build:configure
```

This creates `eas.json` if missing.

### 3. Ensure `preview` profile builds APK

Use this `eas.json` structure:

```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

### 4. Build APK

```bash
eas build -p android --profile preview
```

EAS prints a build URL when complete. Download the `.apk` from that page.

### 5. Install APK on emulator/device (optional)

```bash
adb install path/to/app.apk
```

---

## 🔐 Notes

- Do not commit `.env` files with real keys.
- Keep using `EXPO_PUBLIC_SUPABASE_ANON_KEY` for client auth calls.
- Use `production` profile (`app-bundle`) for Play Store submission.

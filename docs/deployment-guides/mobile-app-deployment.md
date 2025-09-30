# Mobile App Deployment Guide

**Version**: 1.0  
**Last Updated**: 2025-09-30  
**Audience**: Mobile developers and administrators

## Progressive Web App (PWA)

JobEye is a PWA - no native app store deployment needed.

### Installing on Mobile Devices

**iOS (Safari)**:
1. Open JobEye URL in Safari
2. Tap Share button
3. Select "Add to Home Screen"
4. Tap "Add"
5. App icon appears on home screen

**Android (Chrome)**:
1. Open JobEye URL in Chrome
2. Tap menu (⋮)
3. Select "Add to Home Screen"
4. Tap "Add"
5. App icon appears on home screen

### PWA Features
- Works offline (service worker)
- Home screen icon
- Full-screen mode (no browser chrome)
- Push notifications (planned)
- GPS access
- Camera access

## Native App Build (Optional)

If company requires app store distribution:

### iOS (React Native)
```bash
cd mobile
npm install
npx react-native run-ios
```

Build for App Store:
1. Open Xcode project
2. Configure signing & capabilities
3. Archive and upload to App Store Connect
4. Submit for review

### Android (React Native)
```bash
cd mobile
npx react-native run-android
```

Build for Play Store:
1. Generate signed APK
2. Upload to Play Console
3. Submit for review

## Deployment URLs

### Production
- **Web**: https://app.jobeye.com
- **PWA Install**: Same URL (auto-detects mobile)

### Staging
- **Web**: https://staging.jobeye.com
- **PWA Install**: Same URL

## Mobile-Specific Configuration

### Permissions
Ensure manifest.json includes:
```json
{
  "permissions": [
    "geolocation",
    "camera",
    "microphone"
  ]
}
```

### Service Worker
Configured in `public/sw.js`:
- Caches static assets
- Enables offline mode
- Background sync for GPS and tasks

### Testing
1. Test on physical devices (iOS and Android)
2. Verify location permissions prompt
3. Test offline mode
4. Verify GPS tracking accuracy
5. Test camera upload

---
**Document Version**: 1.0

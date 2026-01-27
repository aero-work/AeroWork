#!/bin/bash
# Android Post-Init Script
# Run this after `tauri android init` to configure:
# - Cleartext traffic (ws://) support
# - Keyboard resize behavior
# - Release signing (with debug fallback)
# - Custom MainActivity.kt (keyboard height + back button handling)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ANDROID_APP_DIR="$PROJECT_ROOT/src-tauri/gen/android/app/src/main"
BUILD_GRADLE="$PROJECT_ROOT/src-tauri/gen/android/app/build.gradle.kts"
MAIN_ACTIVITY="$ANDROID_APP_DIR/java/com/aerowork/dev/MainActivity.kt"

echo "Configuring Android build..."

# 1. Create network_security_config.xml
mkdir -p "$ANDROID_APP_DIR/res/xml"
cat > "$ANDROID_APP_DIR/res/xml/network_security_config.xml" << 'EOF'
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Allow cleartext (ws://) for local network connections -->
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>
EOF
echo "Created: res/xml/network_security_config.xml"

# 2. Modify AndroidManifest.xml
MANIFEST="$ANDROID_APP_DIR/AndroidManifest.xml"
if [ -f "$MANIFEST" ]; then
    # Check if already configured
    if grep -q "networkSecurityConfig" "$MANIFEST"; then
        echo "AndroidManifest.xml network config already set, skipping..."
    else
        # Add networkSecurityConfig and usesCleartextTraffic="true"
        sed -i.bak 's|android:usesCleartextTraffic="\${usesCleartextTraffic}"|android:networkSecurityConfig="@xml/network_security_config"\n        android:usesCleartextTraffic="true"|' "$MANIFEST"
        rm -f "$MANIFEST.bak"
        echo "Modified: AndroidManifest.xml (network config)"
    fi

    # Add windowSoftInputMode for keyboard resize behavior
    if grep -q "windowSoftInputMode" "$MANIFEST"; then
        echo "AndroidManifest.xml keyboard config already set, skipping..."
    else
        sed -i.bak 's#android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"#android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"\n            android:windowSoftInputMode="adjustResize"#' "$MANIFEST"
        rm -f "$MANIFEST.bak"
        echo "Modified: AndroidManifest.xml (keyboard resize)"
    fi

    # Add camera permission for QR code scanning
    if grep -q "android.permission.CAMERA" "$MANIFEST"; then
        echo "AndroidManifest.xml camera permission already set, skipping..."
    else
        sed -i.bak 's|<uses-permission android:name="android.permission.INTERNET" />|<uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.CAMERA" />\n\n    <!-- Camera feature (optional, for QR code scanning) -->\n    <uses-feature android:name="android.hardware.camera" android:required="false" />\n    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />|' "$MANIFEST"
        rm -f "$MANIFEST.bak"
        echo "Modified: AndroidManifest.xml (camera permission)"
    fi
else
    echo "Error: AndroidManifest.xml not found at $MANIFEST"
    echo "Please run 'tauri android init' first."
    exit 1
fi

# 3. Configure release signing in build.gradle.kts
if [ -f "$BUILD_GRADLE" ]; then
    if grep -q "signingConfigs" "$BUILD_GRADLE"; then
        echo "build.gradle.kts signing config already set, skipping..."
    else
        echo "Adding signing configuration to build.gradle.kts..."

        # Create a temporary file with the new content
        cat > "$BUILD_GRADLE.new" << 'GRADLE_EOF'
import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("rust")
}

val tauriProperties = Properties().apply {
    val propFile = file("tauri.properties")
    if (propFile.exists()) {
        propFile.inputStream().use { load(it) }
    }
}

android {
    compileSdk = 36
    namespace = "com.aerowork.dev"
    defaultConfig {
        manifestPlaceholders["usesCleartextTraffic"] = "false"
        applicationId = "com.aerowork.dev"
        minSdk = 24
        targetSdk = 36
        versionCode = tauriProperties.getProperty("tauri.android.versionCode", "1").toInt()
        versionName = tauriProperties.getProperty("tauri.android.versionName", "1.0")
    }

    // Signing configuration
    signingConfigs {
        // Release signing - uses keystore if configured, otherwise falls back to debug
        create("release") {
            val keystorePath = System.getenv("ANDROID_KEYSTORE_PATH")
            if (keystorePath != null && file(keystorePath).exists()) {
                storeFile = file(keystorePath)
                storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD") ?: ""
                keyAlias = System.getenv("ANDROID_KEY_ALIAS") ?: "aerowork"
                keyPassword = System.getenv("ANDROID_KEY_PASSWORD") ?: ""
            } else {
                // Fallback to debug signing for release builds
                val debugKeystore = file(System.getProperty("user.home") + "/.android/debug.keystore")
                if (debugKeystore.exists()) {
                    storeFile = debugKeystore
                    storePassword = "android"
                    keyAlias = "androiddebugkey"
                    keyPassword = "android"
                }
            }
        }
    }

    buildTypes {
        getByName("debug") {
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            isDebuggable = true
            isJniDebuggable = true
            isMinifyEnabled = false
            packaging {
                jniLibs.keepDebugSymbols.add("*/arm64-v8a/*.so")
                jniLibs.keepDebugSymbols.add("*/armeabi-v7a/*.so")
                jniLibs.keepDebugSymbols.add("*/x86/*.so")
                jniLibs.keepDebugSymbols.add("*/x86_64/*.so")
            }
        }
        getByName("release") {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = true
            proguardFiles(
                *fileTree(".") { include("**/*.pro") }
                    .plus(getDefaultProguardFile("proguard-android-optimize.txt"))
                    .toList().toTypedArray()
            )
        }
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
    buildFeatures {
        buildConfig = true
    }
}

rust {
    rootDirRel = "../../../"
}

dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("com.google.android.material:material:1.12.0")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.4")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.0")
}

apply(from = "tauri.build.gradle.kts")
GRADLE_EOF

        mv "$BUILD_GRADLE.new" "$BUILD_GRADLE"
        echo "Modified: build.gradle.kts (signing config)"
    fi
else
    echo "Warning: build.gradle.kts not found at $BUILD_GRADLE"
fi

# 4. Copy app icons if they exist
ICONS_SRC="$PROJECT_ROOT/src-tauri/icons/android"
ICONS_DST="$ANDROID_APP_DIR/res"
if [ -d "$ICONS_SRC" ]; then
    echo "Copying Android icons..."
    for dir in mipmap-hdpi mipmap-mdpi mipmap-xhdpi mipmap-xxhdpi mipmap-xxxhdpi; do
        if [ -d "$ICONS_SRC/$dir" ]; then
            cp -r "$ICONS_SRC/$dir" "$ICONS_DST/"
        fi
    done
    echo "Icons copied."
fi

# 5. Replace MainActivity.kt with custom version
# Features: keyboard height detection + back button/gesture handling
echo "Installing custom MainActivity.kt..."
cat > "$MAIN_ACTIVITY" << 'KOTLIN_EOF'
package com.aerowork.dev

import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  private var keyboardHeight = 0
  private var webViewRef: WebView? = null

  override fun onWebViewCreate(webView: WebView) {
    webViewRef = webView
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)

    // Handle Android back gesture (modern approach)
    onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        handleBackPress()
      }
    })

    // Delay keyboard listener setup until WebView is ready
    window.decorView.post {
      setupKeyboardListener()
    }
  }

  // Handle back button press - notify WebView and let frontend decide
  private fun handleBackPress() {
    val wv = webViewRef ?: findWebView()
    wv?.evaluateJavascript("""
      (function() {
        try {
          if (typeof window.androidBackCallback === 'function') {
            return window.androidBackCallback();
          }
          return true;
        } catch (e) {
          return true;
        }
      })()
    """.trimIndent()) { result ->
      if (result == "true") {
        // Frontend says OK to exit, finish the activity
        finish()
      }
      // If result is "false", frontend handled it, do nothing
    }
  }

  // Handle back key when WebView has focus
  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    if (event.keyCode == KeyEvent.KEYCODE_BACK && event.action == KeyEvent.ACTION_DOWN) {
      handleBackPress()
      return true
    }
    return super.dispatchKeyEvent(event)
  }

  private fun setupKeyboardListener() {
    val rootView = window.decorView.findViewById<View>(android.R.id.content)

    // Use WindowInsets API to detect keyboard height
    ViewCompat.setOnApplyWindowInsetsListener(rootView) { view, insets ->
      val imeInsets = insets.getInsets(WindowInsetsCompat.Type.ime())
      val navBarInsets = insets.getInsets(WindowInsetsCompat.Type.navigationBars())

      // IME insets includes navigation bar, subtract it to get pure keyboard height
      val imeHeight = imeInsets.bottom
      val navBarHeight = navBarInsets.bottom
      val pureKeyboardHeight = if (imeHeight > navBarHeight) imeHeight - navBarHeight else 0

      if (pureKeyboardHeight != keyboardHeight) {
        keyboardHeight = pureKeyboardHeight
        notifyKeyboardHeight(pureKeyboardHeight)
      }

      insets
    }
  }

  private fun notifyKeyboardHeight(height: Int) {
    // Notify WebView of keyboard height change
    runOnUiThread {
      try {
        val webView = findWebView()
        webView?.evaluateJavascript(
          "window.__ANDROID_KEYBOARD_HEIGHT__ = $height; " +
          "window.dispatchEvent(new CustomEvent('androidKeyboardHeight', { detail: { height: $height } }));",
          null
        )
      } catch (e: Exception) {
        e.printStackTrace()
      }
    }
  }

  private fun findWebView(): android.webkit.WebView? {
    return findWebViewInView(window.decorView)
  }

  private fun findWebViewInView(view: View): android.webkit.WebView? {
    if (view is android.webkit.WebView) {
      return view
    }
    if (view is android.view.ViewGroup) {
      for (i in 0 until view.childCount) {
        val webView = findWebViewInView(view.getChildAt(i))
        if (webView != null) {
          return webView
        }
      }
    }
    return null
  }
}
KOTLIN_EOF
echo "Created: MainActivity.kt (keyboard + back button handling)"

echo ""
echo "Done! Android is now configured."
echo ""
echo "Build commands:"
echo "  Debug:   bun run tauri android build --target aarch64 --debug"
echo "  Release: bun run tauri android build --target aarch64"
echo ""
echo "Release signing:"
echo "  - Without env vars: Uses debug keystore (for testing)"
echo "  - With env vars:    Uses release keystore"
echo ""
echo "  Environment variables for release signing:"
echo "    ANDROID_KEYSTORE_PATH      - Path to .keystore file"
echo "    ANDROID_KEYSTORE_PASSWORD  - Keystore password"
echo "    ANDROID_KEY_ALIAS          - Key alias (default: aerowork)"
echo "    ANDROID_KEY_PASSWORD       - Key password"
echo ""
echo "  Example:"
echo "    ANDROID_KEYSTORE_PATH=~/keys/aerowork.keystore \\"
echo "    ANDROID_KEYSTORE_PASSWORD=secret \\"
echo "    ANDROID_KEY_ALIAS=aerowork \\"
echo "    ANDROID_KEY_PASSWORD=secret \\"
echo "    bun run tauri android build --target aarch64"

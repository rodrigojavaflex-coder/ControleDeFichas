package com.sistemasfarmamais.app;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

/**
 * Na abertura: splash branco do sistema → overlay nativo (logo + círculo + Carregando)
 * até o Angular avisar que o boot terminou (FarmaBoot.ready).
 */
public class MainActivity extends BridgeActivity {
  private volatile boolean keepSplash = true;
  private View brandOverlay;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    final SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
    splashScreen.setKeepOnScreenCondition(() -> keepSplash);
    splashScreen.setOnExitAnimationListener(splashScreenViewProvider -> {
      // Sai sem animação para o overlay (logo+círculo) aparecer de imediato
      splashScreenViewProvider.remove();
    });

    super.onCreate(savedInstanceState);

    mostrarBrandLoading();
    registrarBootBridge();

    // Mantém o splash com logo até o overlay (logo+círculo) estar na tela
    new Handler(Looper.getMainLooper()).post(() -> keepSplash = false);

    // Segurança: não prende o usuário se o JS não chamar FarmaBoot.ready
    new Handler(Looper.getMainLooper()).postDelayed(this::ocultarBrandLoading, 8000);
  }

  private void mostrarBrandLoading() {
    if (brandOverlay != null) {
      return;
    }
    ViewGroup root = findViewById(android.R.id.content);
    if (root == null) {
      return;
    }
    brandOverlay = getLayoutInflater().inflate(R.layout.brand_loading_overlay, root, false);
    root.addView(brandOverlay);
  }

  private void ocultarBrandLoading() {
    if (brandOverlay == null) {
      return;
    }
    final View overlay = brandOverlay;
    brandOverlay = null;
    overlay
        .animate()
        .alpha(0f)
        .setDuration(280)
        .withEndAction(() -> {
          ViewGroup parent = (ViewGroup) overlay.getParent();
          if (parent != null) {
            parent.removeView(overlay);
          }
        })
        .start();
  }

  private void registrarBootBridge() {
    if (getBridge() == null) {
      return;
    }
    WebView webView = getBridge().getWebView();
    if (webView == null) {
      return;
    }
    webView.addJavascriptInterface(new BootBridge(), "FarmaBoot");
  }

  private class BootBridge {
    @JavascriptInterface
    public void ready() {
      runOnUiThread(() -> ocultarBrandLoading());
    }
  }
}

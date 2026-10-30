package sk.pomocnik.app;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Locale;

/**
 * Pomocník pre Android: zobrazí webovú aplikáciu Pomocník a doplní jej to, čo prehliadač nevie:
 * volanie priamo bez obrazovky vytáčania, slovenský hlas a rozpoznávanie reči cez Android.
 * Webová časť sa načítava z internetu, takže jej úpravy sa prejavia bez preinštalovania.
 */
public class MainActivity extends Activity {

    private static final String APP_URL = "https://matko1996.github.io/pomocnik/";
    private static final String APP_HOST = "matko1996.github.io";
    private static final int REQ_FILE = 10;
    private static final int REQ_PERM = 11;

    private final Handler main = new Handler(Looper.getMainLooper());
    private WebView web;
    private TextToSpeech tts;
    private boolean ttsReady;
    private boolean ttsSlovak;
    private SpeechRecognizer recognizer;
    private ValueCallback<Uri[]> fileCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        web.addJavascriptInterface(new Bridge(), "PomocnikAndroid");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (APP_HOST.equals(u.getHost())) return false;
                if ("tel".equals(u.getScheme())) {
                    placeCall(u.getSchemeSpecificPart());
                    return true;
                }
                // Cudzie stránky sa v Pomocníkovi neotvárajú.
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent i = params.createIntent();
                i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                try {
                    startActivityForResult(i, REQ_FILE);
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                request.deny();   // mikrofón ide cez Android, nie cez stránku
            }
        });

        tts = new TextToSpeech(this, status -> {
            if (status != TextToSpeech.SUCCESS) return;
            int r = tts.setLanguage(new Locale("sk", "SK"));
            ttsSlovak = r >= TextToSpeech.LANG_AVAILABLE;
            ttsReady = true;
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String id) { }
                @Override public void onDone(String id) { ttsDone(id); }
                @Override public void onError(String id) { ttsDone(id); }
                @Override public void onStop(String id, boolean interrupted) { ttsDone(id); }
            });
        });

        askPermissions();
        web.loadUrl(APP_URL);
    }

    private void askPermissions() {
        ArrayList<String> need = new ArrayList<>();
        for (String p : new String[]{Manifest.permission.RECORD_AUDIO, Manifest.permission.CALL_PHONE}) {
            if (checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) need.add(p);
        }
        if (!need.isEmpty()) requestPermissions(need.toArray(new String[0]), REQ_PERM);
    }

    // Volanie priamo, bez obrazovky s číslom. Bez povolenia aspoň otvorí vytáčanie.
    private void placeCall(String number) {
        Uri uri = Uri.parse("tel:" + Uri.encode(number));
        boolean direct = checkSelfPermission(Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED;
        try {
            startActivity(new Intent(direct ? Intent.ACTION_CALL : Intent.ACTION_DIAL, uri));
        } catch (Exception e) {
            try { startActivity(new Intent(Intent.ACTION_DIAL, uri)); } catch (Exception ignored) { }
        }
    }

    private void js(String code) {
        main.post(() -> { if (web != null) web.evaluateJavascript(code, null); });
    }

    private void ttsDone(String id) {
        js("window.__pomocnikTts && __pomocnikTts(" + JSONObject.quote(id) + ")");
    }

    private void emitSpeech(String type, String data) {
        js("window.__pomocnikSR && __pomocnikSR(" + JSONObject.quote(type) + "," + JSONObject.quote(data) + ")");
    }

    // ---------- Rozpoznávanie reči ----------

    private final RecognitionListener listener = new RecognitionListener() {
        @Override public void onReadyForSpeech(Bundle params) { }
        @Override public void onBeginningOfSpeech() { }
        @Override public void onRmsChanged(float rmsdB) { }
        @Override public void onBufferReceived(byte[] buffer) { }
        @Override public void onEndOfSpeech() { }
        @Override public void onPartialResults(Bundle partialResults) { }
        @Override public void onEvent(int eventType, Bundle params) { }

        @Override
        public void onResults(Bundle results) {
            ArrayList<String> list = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            if (list == null || list.isEmpty()) {
                emitSpeech("error", "no-speech");
            } else {
                emitSpeech("result", new JSONArray(list).toString());
            }
            emitSpeech("end", "");
        }

        @Override
        public void onError(int error) {
            String code;
            switch (error) {
                case SpeechRecognizer.ERROR_NO_MATCH:
                case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                    code = "no-speech"; break;
                case SpeechRecognizer.ERROR_NETWORK:
                case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                case SpeechRecognizer.ERROR_SERVER:
                    code = "network"; break;
                case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                    code = "not-allowed"; break;
                case SpeechRecognizer.ERROR_CLIENT:
                case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
                    code = "aborted"; break;
                default:
                    code = "unknown";
            }
            emitSpeech("error", code);
            emitSpeech("end", "");
        }
    };

    private void startListening(String lang) {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            askPermissions();
            emitSpeech("error", "not-allowed");
            emitSpeech("end", "");
            return;
        }
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            emitSpeech("error", "service-not-allowed");
            emitSpeech("end", "");
            return;
        }
        if (recognizer == null) {
            recognizer = SpeechRecognizer.createSpeechRecognizer(this);
            recognizer.setRecognitionListener(listener);
        }
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, lang);
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5);
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2500L);
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 2500L);
        recognizer.startListening(i);
    }

    // ---------- Most pre webovú časť (window.PomocnikAndroid) ----------

    private class Bridge {
        @JavascriptInterface
        public void speak(String text, float rate, String id) {
            if (!ttsReady) { ttsDone(id); return; }
            tts.setSpeechRate(rate);
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, id);
        }

        @JavascriptInterface
        public void stopSpeaking() {
            if (ttsReady) tts.stop();
        }

        @JavascriptInterface
        public boolean ttsReady() {
            return ttsReady;
        }

        @JavascriptInterface
        public boolean hasSlovakVoice() {
            return ttsSlovak;
        }

        @JavascriptInterface
        public void listen(String lang) {
            main.post(() -> startListening(lang));
        }

        @JavascriptInterface
        public void stopListening() {
            main.post(() -> { if (recognizer != null) recognizer.cancel(); });
        }

        @JavascriptInterface
        public void call(String number) {
            main.post(() -> placeCall(number));
        }

        @JavascriptInterface
        public boolean canCallDirectly() {
            return checkSelfPermission(Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED;
        }

        @JavascriptInterface
        public void keepAwake(boolean on) {
            main.post(() -> {
                if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }

        // Uloží zálohu nastavení do priečinka Stiahnuté súbory.
        @JavascriptInterface
        public String saveFile(String name, String text) {
            try {
                ContentValues v = new ContentValues();
                v.put(MediaStore.Downloads.DISPLAY_NAME, name);
                v.put(MediaStore.Downloads.MIME_TYPE, "application/json");
                Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (uri == null) return "Súbor sa nedá vytvoriť.";
                try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                    if (os == null) return "Súbor sa nedá otvoriť.";
                    os.write(text.getBytes(StandardCharsets.UTF_8));
                }
                return "ok";
            } catch (Exception e) {
                return String.valueOf(e.getMessage());
            }
        }

        @JavascriptInterface
        public String version() {
            try {
                return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            } catch (Exception e) {
                return "?";
            }
        }
    }

    // ---------- Životný cyklus ----------

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_FILE || fileCallback == null) return;
        Uri[] result = null;
        if (resultCode == RESULT_OK && data != null) {
            ClipData clip = data.getClipData();
            if (clip != null) {
                result = new Uri[clip.getItemCount()];
                for (int i = 0; i < clip.getItemCount(); i++) result[i] = clip.getItemAt(i).getUri();
            } else if (data.getData() != null) {
                result = new Uri[]{data.getData()};
            }
        }
        fileCallback.onReceiveValue(result);
        fileCallback = null;
    }

    // Tlačidlo Späť: krok späť v Pomocníkovi, aplikácia sa ním nikdy nezavrie.
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        web.evaluateJavascript("window.__pomocnikBack ? __pomocnikBack() : false", null);
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onPause() {
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (recognizer != null) recognizer.destroy();
        if (tts != null) tts.shutdown();
        web.destroy();
        super.onDestroy();
    }
}

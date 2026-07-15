package com.duobiblia.app;

import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;

@CapacitorPlugin(name = "VerseShare")
public class VerseSharePlugin extends Plugin {
    @PluginMethod
    public void shareImage(PluginCall call) {
        String base64 = call.getString("base64", "");
        String title = call.getString("title", "DuoBiblia");
        String text = call.getString("text", "");
        if (base64.isEmpty()) {
            call.reject("La imagen del versículo está vacía");
            return;
        }

        try {
            File shareDirectory = new File(getContext().getCacheDir(), "shared");
            if (!shareDirectory.exists() && !shareDirectory.mkdirs()) {
                call.reject("No se pudo preparar la imagen para compartir");
                return;
            }
            File image = new File(shareDirectory, "duobiblia-verse.png");
            try (FileOutputStream stream = new FileOutputStream(image, false)) {
                stream.write(Base64.decode(base64, Base64.DEFAULT));
            }

            Uri uri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                image
            );
            Intent sendIntent = new Intent(Intent.ACTION_SEND);
            sendIntent.setType("image/png");
            sendIntent.putExtra(Intent.EXTRA_STREAM, uri);
            sendIntent.putExtra(Intent.EXTRA_TEXT, text);
            sendIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            sendIntent.setClipData(ClipData.newUri(getContext().getContentResolver(), title, uri));

            Intent chooser = Intent.createChooser(sendIntent, title);
            getActivity().startActivity(chooser);
            call.resolve();
        } catch (Exception error) {
            call.reject("No se pudo compartir el versículo", error);
        }
    }
}

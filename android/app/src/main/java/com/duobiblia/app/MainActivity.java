package com.duobiblia.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(PremiumStatePlugin.class);
        registerPlugin(VerseSharePlugin.class);
    }
}

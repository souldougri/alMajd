package com.almadjd.app;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Navy status bar (#14324D) to match the brand theme.
        getWindow().setStatusBarColor(getColor(R.color.colorPrimaryDark));
        getWindow().setNavigationBarColor(getColor(R.color.colorPrimaryDark));
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView())
            .setAppearanceLightStatusBars(false);
    }
}
package io.ionic.demo.pg.cap.ng;

 import android.os.Bundle;
 import com.fithabitos.ble.PerifericoBlePlugin;
  import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
 @Override
     public void onCreate(Bundle savedInstanceState) {
       registerPlugin(PerifericoBlePlugin.class);   // ANTES de super.onCreate
        super.onCreate(savedInstanceState);
     }
}
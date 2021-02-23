package core.appium_server_manager;

import io.appium.java_client.service.local.AppiumDriverLocalService;
import io.appium.java_client.service.local.AppiumServiceBuilder;
import io.appium.java_client.service.local.flags.GeneralServerFlag;

import java.net.URL;
import java.util.concurrent.TimeUnit;

public class AppiumServerManager {
    AppiumDriverLocalService service;
    AppiumServiceBuilder builder;

    public URL startAppiumServer() {
        URL url;
        builder = new AppiumServiceBuilder();
        builder.withIPAddress("127.0.0.1");
        builder.usingAnyFreePort();
        builder.withStartUpTimeOut(20000, TimeUnit.MILLISECONDS);
        builder.withArgument(GeneralServerFlag.LOG_LEVEL, "error");

        service = AppiumDriverLocalService.buildService(builder);
        service.start();
        url = service.getUrl();
        return url;
    }
}

package core.appium_server_manager;

import io.appium.java_client.service.local.AppiumDriverLocalService;
import io.appium.java_client.service.local.AppiumServiceBuilder;
import io.appium.java_client.service.local.flags.GeneralServerFlag;
import org.apache.log4j.Logger;

import java.net.URL;
import java.util.concurrent.TimeUnit;

public class AppiumServerManager {
    AppiumDriverLocalService service;
    AppiumServiceBuilder builder;
    private static Logger logger = Logger.getLogger(AppiumServerManager.class);

    public URL startAppiumServer() {
        URL url;
        builder = new AppiumServiceBuilder();
        builder.withIPAddress("127.0.0.1");
        builder.usingAnyFreePort();
        builder.withStartUpTimeOut(20000, TimeUnit.MILLISECONDS);
        builder.withArgument(GeneralServerFlag.LOG_LEVEL, "debug");
        builder.withArgument(GeneralServerFlag.ALLOW_INSECURE,"adb_shell"); //Specify a list of features which will never be allowed to run, even if --relaxed-security

        service = AppiumDriverLocalService.buildService(builder);
        service.start();
        url = service.getUrl();
        logger.info("Server URL is : "+url.toString());
        return url;
    }
}

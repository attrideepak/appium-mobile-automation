package core.driver_manager;

import core.appium_server_manager.AppiumServerManager;
import core.configurations.BaseConfig;
import io.appium.java_client.AppiumDriver;
import io.appium.java_client.android.AndroidDriver;
import org.apache.log4j.Logger;
import org.openqa.selenium.remote.DesiredCapabilities;

import java.io.File;
import java.net.URL;
import java.util.Random;
import java.util.concurrent.TimeUnit;

public class AndroidDriverManager {

    private DesiredCapabilities capabilities;
    private AppiumServerManager appiumServerManager;
    AppiumDriver appiumDriver;
    private static Logger logger = Logger.getLogger(AndroidDriverManager.class);


    public AppiumDriver getDriver(String appName){
        capabilities = new DesiredCapabilities();
        if(appName.toLowerCase().contains("zoomcar")) {
            String path = System.getProperty("user.dir")+"/src/main/resources/app-release.apk";
            File apk = new File(path);

            capabilities.setCapability("app",apk);
            capabilities.setCapability("platformName", "android");
            capabilities.setCapability("deviceName", "emulator-5554");
           // capabilities.setCapability("platformVersion", baseConfig.getDevice().getOsVersion());
            capabilities.setCapability("appActivity", "com.zoomcar");
            capabilities.setCapability("appPackage", "com.zoomcar.SplashActivity");
            capabilities.setCapability("newCommandTimeout", 500); //seconds Appium will wait for a new command from the client before assuming the client quit and ending the session
           // capabilities.setCapability("unicodeKeyboard", true);
           // capabilities.setCapability("resetKeyboard", true);
            capabilities.setCapability("automationName", "Espresso");
            capabilities.setCapability("systemPort", 8200 + new Random().nextInt(20));
            capabilities.merge(extraCapabilities());
        }else{
            logger.info("App name is not correct");
        }
        try {
            URL url = appiumServerManager.startAppiumServer();
            appiumDriver = new AndroidDriver(url, capabilities);
        }catch(Exception e) {
            e.printStackTrace();
        }
        appiumDriver.manage().timeouts().implicitlyWait(30, TimeUnit.SECONDS);
        return appiumDriver;
    }

    private DesiredCapabilities extraCapabilities(){
         capabilities = new DesiredCapabilities();
        //capabilities.setCapability("unicodeKeyboard", true);
        //capabilities.setCapability("resetKeyboard", true);
        return capabilities;
    }
}

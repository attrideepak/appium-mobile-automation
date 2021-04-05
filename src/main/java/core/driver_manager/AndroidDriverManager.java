package core.driver_manager;

import core.appium_server_manager.AppiumServerManager;
import core.constants.Constants;
import io.appium.java_client.AppiumDriver;
import io.appium.java_client.android.AndroidDriver;
import io.appium.java_client.remote.MobileCapabilityType;
import org.apache.log4j.Logger;
import org.openqa.selenium.remote.DesiredCapabilities;

import java.io.File;
import java.net.URL;
import java.util.Random;
import java.util.concurrent.TimeUnit;

public class AndroidDriverManager {

    private DesiredCapabilities capabilities;
    private AppiumServerManager appiumServerManager = new AppiumServerManager();
    AppiumDriver appiumDriver = null;
    private static Logger logger = Logger.getLogger(AndroidDriverManager.class);

    String appPackage = Constants.PACKAGE_NAME.DEBUG_PACKAGE.getPackageName();


    public AppiumDriver getDriver(String appName){
        capabilities = new DesiredCapabilities();
        if(appName.toLowerCase().contains("zoomcar")) {
            String path = System.getProperty("user.dir")+"/src/main/resources/app-debug.apk";
            File apk = new File(path);
            capabilities.setCapability("app",apk.getAbsolutePath());
            capabilities.setCapability("platformName", "android");
            capabilities.setCapability("deviceName", "emulator-5554");
           // capabilities.setCapability("platformVersion", baseConfig.getDevice().getOsVersion());
            capabilities.setCapability("appPackage", appPackage);
            capabilities.setCapability("appActivity", "com.zoomcar.activity.SplashActivity");
            capabilities.setCapability("newCommandTimeout", 500); //seconds Appium will wait for a new command from the client before assuming the client quit and ending the session
            //	Enable Unicode input, default
            capabilities.setCapability("unicodeKeyboard", true);
            //Reset keyboard to its original state, after running Unicode tests with unicodeKeyboard capability. Ignored if used alone. Default false
            capabilities.setCapability("resetKeyboard", true);
            capabilities.setCapability("automationName", "UiAutomator2");
            capabilities.setCapability("systemPort", 8200 + new Random().nextInt(20));
            capabilities.merge(extraCapabilities());
            logger.info("Capabilities are set");
            logger.info(capabilities.toJson());
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
        logger.info("Appium driver initiated");
        return appiumDriver;
    }

    private DesiredCapabilities extraCapabilities(){
        capabilities.setCapability(MobileCapabilityType.NO_RESET,true);
        // capabilities.setCapability(MobileCapabilityType.FULL_RESET,false);
        capabilities.setCapability("unlockType","pin");
        capabilities.setCapability("unlockKey","1234");
        return capabilities;
    }


}

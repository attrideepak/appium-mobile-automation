package core.driver_manager;

import core.appium_server_manager.AppiumServerManager;
import core.configurations.BaseConfig;
import core.constants.Constants;
import io.appium.java_client.AppiumDriver;
import io.appium.java_client.android.AndroidDriver;
import io.appium.java_client.remote.MobileCapabilityType;
import org.apache.log4j.Logger;
import org.openqa.selenium.logging.LogEntries;
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
        capabilities.setCapability("clearDeviceLogsOnStart", true);
        //When a find operation fails, print the current page source. Useful for debugging and diagnosing test failures Value = true/false
        capabilities.setCapability("printPageSourceOnFindFailure",true);
        //This capability will set the network condition which will be required for your test.
        // For Ex. if you want to test your app in a cellular data condition you can mock it in the emulator with the help of given capability.
        // Note: This is not compatible for Real devices.
        capabilities.setCapability("networkSpeed", "gprs");
        //capabilities.setCapability("isHeadless", true); //Set this capability to true to run emulators or simulators in headless mode.
       // capabilities.setCapability("unlockType","pattern");  //['pin', 'password', 'pattern', 'fingerprint']
       // capabilities.setCapability("unlockKey","1111");  //We treat the pattern pins as the numbers of a phone dial. So in this case the unlockKey would be 729854163
        //Maximum frequency of keystrokes for typing and clearing a text field. If your tests are failing because of typing errors, you may want to
        //adjust this. Values in keystroked per minute.
       // capabilities.setCapability("maxTypingFrequency",15);
        //capabilities.setCapability("screenShotOnError", true);
        //capabilities.setCapability("autoWebview", true);
//       Have Appium automatically determine which permissions your app requires and grant them to the app on install.
//     Defaults to false.If noReset is true, this capability doesn't work.
        capabilities.setCapability("autoGrantPermissions",true);

        return capabilities;
    }
}

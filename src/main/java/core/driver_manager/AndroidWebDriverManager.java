package core.driver_manager;

import core.appium_server_manager.AppiumServerManager;
import io.appium.java_client.AppiumDriver;
import io.appium.java_client.android.AndroidDriver;
import io.appium.java_client.remote.AndroidMobileCapabilityType;
import org.apache.log4j.Logger;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.remote.DesiredCapabilities;

import java.net.URL;
import java.util.Random;
import java.util.concurrent.TimeUnit;

public class AndroidWebDriverManager {
    private static Logger logger = Logger.getLogger(AndroidDriverManager.class);

    private DesiredCapabilities capabilities;
    private AppiumServerManager appiumServerManager = new AppiumServerManager();
    AppiumDriver appiumDriver = null;

    public AppiumDriver getDriver() {
        capabilities = new DesiredCapabilities();
        ChromeOptions chromeOptions = new ChromeOptions();
        chromeOptions.addArguments("--incognito");
        capabilities.setCapability(AndroidMobileCapabilityType.CHROME_OPTIONS,chromeOptions);
        capabilities.setCapability(AndroidMobileCapabilityType.BROWSER_NAME, "Chrome");
        capabilities.setCapability("platformName", "android");
        capabilities.setCapability("deviceName", "emulator-5554");
        capabilities.setCapability("newCommandTimeout", 500);
        capabilities.setCapability("unicodeKeyboard", true);
        capabilities.setCapability("resetKeyboard", true);
        capabilities.setCapability("automationName", "UiAutomator2");
        //capabilities.setCapability("chromedriverExecutableDir",System.getProperty("user.dir")+"/src/main/resources/");
        capabilities.setCapability("chromedriverExecutable", System.getProperty("user.dir") + "/src/main/resources/chromedriver");
        //capabilities.setCapability("chromedriverUseSystemExecutable",true);
        capabilities.setCapability("systemPort", 8200 + new Random().nextInt(20));
        logger.info("Capabilities are set");
        logger.info(capabilities.toJson());
        try {
            URL url = appiumServerManager.startAppiumServer();
            appiumDriver = new AndroidDriver(url, capabilities);
        } catch (Exception e) {
            e.printStackTrace();
        }
        appiumDriver.manage().timeouts().implicitlyWait(30, TimeUnit.SECONDS);
        logger.info("Appium driver initiated");
        return appiumDriver;
    }


}

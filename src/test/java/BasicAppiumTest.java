import io.appium.java_client.AppiumDriver;
import io.appium.java_client.MobileElement;
import io.appium.java_client.android.AndroidDriver;
import io.appium.java_client.android.AndroidElement;
import io.appium.java_client.remote.MobileCapabilityType;
import org.apache.log4j.Logger;
import org.junit.Test;
import org.openqa.selenium.remote.DesiredCapabilities;
import org.testng.Assert;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.AfterTest;

import java.io.File;
import java.net.MalformedURLException;
import java.net.URL;
import java.util.concurrent.TimeUnit;

public class BasicAppiumTest {

    private static Logger logger = Logger.getLogger(BasicAppiumTest.class);
    AndroidDriver<AndroidElement> driver = null;


    @Test
    public void basicTest(){
        String path = System.getProperty("user.dir") + "/src/main/resources/ApiDemos-debug.apk";
        File apk = new File(path);

        DesiredCapabilities capabilities = new DesiredCapabilities();
        capabilities.setCapability(MobileCapabilityType.DEVICE_NAME,"emulator-5554");   //By default appium picks up the first device that is opened. Need to change the name if you want to work on any other device
        capabilities.setCapability(MobileCapabilityType.APP, apk.getAbsolutePath());
       // capabilities.setCapability(MobileCapabilityType.PLATFORM_NAME, "android");   //required when AppiumDriver instance is used instead of Android driver
       // capabilities.setCapability("appPackage","io.appium.android.apis");
       // capabilities.setCapability("appActivity","io.appium.android.apis.ApiDemos");
        capabilities.setCapability("automationName","Espresso"); //Espresso,UiAutomator2,UiAutomator1 for Android, XCUITest,Instruments


        try {
            driver = new AndroidDriver<>(new URL("http://127.0.0.1:4723/wd/hub"),capabilities);
        } catch (MalformedURLException e) {
            e.printStackTrace();
        }

        logger.info("*********** App launched *************");
        AndroidElement accessiblityButton= driver.findElementByAccessibilityId("Accessibility");
        accessiblityButton.click();

        try {
            Thread.sleep(10);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }


    }

    @AfterTest
    public void tearDown(){
        driver.close();
    }
}

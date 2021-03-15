package Android;

import base_test.BaseTest;
import core.utils.MobileCommonActions;
import io.appium.java_client.AppiumDriver;
import org.apache.log4j.Logger;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

public class MobileBrowserTest extends BaseTest {
    private MobileCommonActions mobileCommonActions;
    private AppiumDriver localAppiumDriver;
    private static Logger logger = Logger.getLogger(MobileBrowserTest.class);

    @BeforeClass
    public void beforeClass(){
        localAppiumDriver = (AppiumDriver) super.driver;
    }

   @Test
    public void browserTest(){
        localAppiumDriver.get("http://www.google.com");
       try {
           Thread.sleep(30000);
       } catch (InterruptedException e) {
           e.printStackTrace();
       }
   }
}

package base_test;

import core.driver_manager.AndroidDriverManager;
import core.utils.LogcatUtils;
import core.utils.MobileCommonActions;
import io.appium.java_client.AppiumDriver;
import org.apache.log4j.Logger;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.logging.LogEntries;
import org.openqa.selenium.logging.LogEntry;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.ISuite;
import org.testng.ISuiteListener;
import org.testng.annotations.AfterTest;
import org.testng.annotations.BeforeTest;

import java.util.List;
import java.util.Set;
import java.util.stream.StreamSupport;

public class BaseTest{

    public WebDriver driver;
    public WebDriverWait wait;
    String appName = "zoomcar";
    private MobileCommonActions mobileCommonActions;
    private static Logger logger = Logger.getLogger(BaseTest.class);


    @BeforeTest
    public void onStart() {
        driver = new AndroidDriverManager().getDriver(appName);
        wait = new WebDriverWait(driver, 30);
    }

    @AfterTest
    public void onFinish() {
        driver.quit();
    }
}

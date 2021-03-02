package base_test;

import core.driver_manager.AndroidDriverManager;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.ISuite;
import org.testng.ISuiteListener;
import org.testng.annotations.BeforeTest;

public class BaseTest{

    public WebDriver driver;
    public WebDriverWait wait;
    String appName = "zoomcar";


    @BeforeTest
    public void onStart() {
        driver = new AndroidDriverManager().getDriver(appName);
        wait = new WebDriverWait(driver, 30);
    }


    public void onFinish() {
        driver.quit();
    }
}

package base_test;

import core.driver_manager.AndroidDriverManager;
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
    private static Logger logger = Logger.getLogger(BaseTest.class);


    @BeforeTest
    public void onStart() {
        driver = new AndroidDriverManager().getDriver(appName);
        wait = new WebDriverWait(driver, 30);
//        Set<String> logsTypes = driver.manage().logs().getAvailableLogTypes();
//        logger.info("Getting logcats");
//        LogEntries logEnteries = driver.manage().logs().get("logcat");
//        logger.info("First and last ten lines of log: ");
//        StreamSupport.stream(logEnteries.spliterator(), false).limit(10).forEach(System.out::println);
//        logger.info("**********************");
//        StreamSupport.stream(logEnteries.spliterator(), false).skip(logEnteries.getAll().size() - 10).forEach(System.out::println);

    }

    @AfterTest
    public void onFinish() {
        driver.quit();
    }
}

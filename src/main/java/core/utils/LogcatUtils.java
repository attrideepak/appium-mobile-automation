package core.utils;

import io.appium.java_client.AppiumDriver;
import org.apache.log4j.Logger;
import org.openqa.selenium.logging.LogEntries;
import java.util.stream.StreamSupport;

public class LogcatUtils {

    private static Logger logger = Logger.getLogger(LogcatUtils.class);


    public static void getFirstNLines(int n,AppiumDriver localAppiumDriver){
        logger.info("Getting logcats");
        LogEntries logEnteries = localAppiumDriver.manage().logs().get("logcat");
        logger.info("First "+n+ " lines of log: ");
        StreamSupport.stream(logEnteries.spliterator(), false).limit(n).forEach(System.out::println);
        logger.info("**********************");
    }

    public static void getLastNLines(int n,AppiumDriver localAppiumDriver){
        logger.info("Getting logcats");
        LogEntries logEnteries = localAppiumDriver.manage().logs().get("logcat");
        logger.info("Last "+n+ " lines of log: ");
        StreamSupport.stream(logEnteries.spliterator(), false).skip(logEnteries.getAll().size() - 10).forEach(System.out::println);
        logger.info("**********************");
    }

    public static void getPackageSpecificLogs(AppiumDriver localAppiumDriver,int packageId){
        LogEntries logEnteries = localAppiumDriver.manage().logs().get("logcat");
        logger.info("Getting logcats");
        StreamSupport.stream(logEnteries.spliterator(), false)
                .filter(s -> s.toString()
                        .contains(String.valueOf(packageId)))
                .forEach(System.out::println);
        logger.info("**********************");
    }
}

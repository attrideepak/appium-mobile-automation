package core.utils;

import org.apache.commons.io.FileUtils;
import org.apache.log4j.Logger;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;


public class CommonActions {

    private WebDriver localWebDriver;
    private static Logger logger = Logger.getLogger(CommonActions.class);

    public CommonActions(WebDriver localWebDriver) {
        this.localWebDriver = localWebDriver;
    }

    public void waitForElementToBeClickable(WebElement myElement) {
        try {
            WebDriverWait wait = new WebDriverWait(localWebDriver, 20);
            wait.until(ExpectedConditions.elementToBeClickable(myElement));
        } catch (Exception e) {
           // takeScreenShot();
            throw new RuntimeException(e);
        }
    }


    public void waitForElementVisibility(WebElement myElement) {
        try {
            WebDriverWait wait = new WebDriverWait(localWebDriver, 20);
            wait.until(ExpectedConditions.visibilityOf(myElement));
        } catch (Exception e) {
            takeScreenShot();
            throw new RuntimeException(e);
        }
    }

    public void enterText(WebElement myElement, String text) {
        try {
            waitForElementVisibility(myElement);
            myElement.sendKeys(text.trim());
        } catch (Exception e) {
            takeScreenShot();
            throw new RuntimeException(e);
        }
    }

    public void cleartext(WebElement myElement) {
        try {
            myElement.click();
            myElement.clear();
        } catch (Exception e) {
            takeScreenShot();
            throw new RuntimeException(e);
        }
    }

    public String getText(WebElement myElement) {
        try {
            String text;
            text = myElement.getText();
            return text;
        } catch (Exception e) {
            takeScreenShot();
            throw new RuntimeException(e);
        }
    }

    public boolean isDisplayed(WebElement myElement) {
        boolean displayed = false;
        try {
            displayed = myElement.isDisplayed();
        } catch (Exception e) {
            takeScreenShot();
            logger.warn("Element is not displayed. \t Exception found is: " + e.getMessage());
        }
        return displayed;
    }

    public boolean isEnabled(WebElement myElement) {
        boolean enabled = false;
        try {
            enabled = myElement.isEnabled();
        } catch (Exception e) {
            logger.warn("Element is not enabled. \t Exception found is: " + e.getMessage());
            takeScreenShot();
        }
        return enabled;
    }



    //@Attachment(value = "Page screenshot", type = "image/png")
    public byte[] takeScreenShot() {
        logger.info("taking screenshot!");
        try {
            return ((TakesScreenshot) localWebDriver).getScreenshotAs(OutputType.BYTES);
        } catch (Exception e) {
            logger.error(e.getMessage());
            logger.error(e.getStackTrace().toString());
            return null;
        }
    }

    public void takeScreenShot(String name) {
        logger.info("taking screenshot!");

        File scrFile;
        try {
            scrFile = ((TakesScreenshot) localWebDriver).getScreenshotAs(OutputType.FILE);
        } catch (Exception e) {
            logger.error(e.getMessage());
            logger.error(e.getStackTrace());
            return;
        }
        String path = System.getProperty("user.dir") + "/target/screenshots/";
        String timeStamp;
        timeStamp = String.valueOf(DateUtils.getTimeInMilliSecond());
        String fileName = path + (name == null ? "" : name + "_") + timeStamp + ".png";
        logger.info(fileName);
        try {
            FileUtils.copyFile(scrFile, new File(fileName));
        } catch (IOException e) {
            e.printStackTrace();
        }
        Path content = Paths.get(fileName);
        try (InputStream is = Files.newInputStream(content)) {
           // Allure.addAttachment("Failed Test Screenshot - " + fileName.split(path)[1], is);
        } catch (IOException e) {
            logger.error("attachment error");
        }
    }

}

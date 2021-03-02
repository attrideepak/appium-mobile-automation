package core.utils;

import org.apache.log4j.Logger;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

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
}

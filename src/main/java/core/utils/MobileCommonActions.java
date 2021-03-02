package core.utils;

import io.appium.java_client.AppiumDriver;
import io.appium.java_client.MobileBy;
import org.apache.log4j.Logger;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

public class MobileCommonActions extends CommonActions {
    public AppiumDriver localAppiumDriver;

    private static Logger logger = Logger.getLogger(MobileCommonActions.class);

    public MobileCommonActions(WebDriver localAppiumDriver) {
        super(localAppiumDriver);
        this.localAppiumDriver = (AppiumDriver) localAppiumDriver;
    }

    public void clickElement(WebElement myElement) {
        waitForElementToBeClickable(myElement);
        try {
            myElement.click();
        } catch (Exception e) {
           // takeScreenShot();
            throw new RuntimeException(e);
        }
    }

    public WebElement scrollHorizontallyToElementUsingText(
            String scrollableListResourceId, String text) {

        WebElement element =
                this.localAppiumDriver.findElement(
                        MobileBy.AndroidUIAutomator(
                                "new UiScrollable(new UiSelector().resourceId(\""
                                        + scrollableListResourceId
                                        + "\")).setAsHorizontalList().scrollIntoView("
                                        + "new UiSelector().text(\""
                                        + text
                                        + "\"))"));
        return element;
    }

    public void bringAppInForeground(String packageName) {
        try {
            this.localAppiumDriver.activateApp(packageName);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

}

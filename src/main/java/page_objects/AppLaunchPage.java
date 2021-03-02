package page_objects;

import core.utils.MobileCommonActions;
import io.appium.java_client.AppiumDriver;
import io.appium.java_client.pagefactory.AppiumFieldDecorator;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.FindBy;
import org.openqa.selenium.support.PageFactory;

public class AppLaunchPage {
    private AppiumDriver localAppiumDriver;
    private MobileCommonActions mobileCommonActions;
    private static final String packageName = "com.zoomcar";


    public AppLaunchPage(AppiumDriver driver) {
        localAppiumDriver = driver;
        mobileCommonActions = new MobileCommonActions(localAppiumDriver);
        PageFactory.initElements(new AppiumFieldDecorator(localAppiumDriver), this);
    }

    @FindBy(id = packageName+":id/button_continue")
    private WebElement getStartedButton;

    public void navigateToCitySelectionPage() {
        mobileCommonActions.bringAppInForeground(packageName);
        mobileCommonActions.scrollHorizontallyToElementUsingText(
                packageName+":id/image_tutorial", "GET STARTED");
        mobileCommonActions.clickElement(getStartedButton);
    }


}

package page_objects;

import core.utils.MobileCommonActions;
import io.appium.java_client.AppiumDriver;
import io.appium.java_client.pagefactory.AndroidFindBy;
import io.appium.java_client.pagefactory.AppiumFieldDecorator;
import org.apache.log4j.Logger;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.PageFactory;

public class AppLaunchPage {

    private AppiumDriver localAppiumDriver;
    private MobileCommonActions mobileCommonActions;
    private static final String packageName = "com.zoomcar";
    private static Logger logger = Logger.getLogger(AppLaunchPage.class);



    public AppLaunchPage(AppiumDriver driver) {
        localAppiumDriver = driver;
        mobileCommonActions = new MobileCommonActions(localAppiumDriver);
        PageFactory.initElements(new AppiumFieldDecorator(localAppiumDriver), this);
    }

    @AndroidFindBy(id = packageName+":id/button_continue")
    private WebElement getStartedButton;


    public LocationAccessPage navigateToLocationAccessPage() {
        mobileCommonActions.bringAppInForeground(packageName);
        mobileCommonActions.scrollHorizontallyToElementUsingText(
                packageName+":id/image_tutorial", "GET STARTED");
        mobileCommonActions.clickElement(getStartedButton);
        return  new LocationAccessPage(localAppiumDriver);
    }


}

package page_objects;

import core.utils.MobileCommonActions;
import io.appium.java_client.AppiumDriver;
import io.appium.java_client.pagefactory.AndroidFindBy;
import io.appium.java_client.pagefactory.AppiumFieldDecorator;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.PageFactory;

public class LocationAccessPage {
    AppiumDriver driver;
    private MobileCommonActions mobileCommonActions;
    private static final String packageName = "com.zoomcar";

    public LocationAccessPage(AppiumDriver driver){
        this.driver = driver;
        mobileCommonActions = new MobileCommonActions(this.driver);
        PageFactory.initElements(new AppiumFieldDecorator(this.driver),this);
    }

    @AndroidFindBy(id = packageName+":id/button_action")
    private WebElement grantAccessButton;

    @AndroidFindBy(id = packageName+":id/icon_back")
    private WebElement crossButton;

    public CitySelectionPage clickCrossButton(){
        mobileCommonActions.clickElement(crossButton);
        return new CitySelectionPage(this.driver);
    }
}

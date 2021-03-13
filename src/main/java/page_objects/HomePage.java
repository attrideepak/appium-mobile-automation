package page_objects;

import core.utils.MobileCommonActions;
import io.appium.java_client.AppiumDriver;
import io.appium.java_client.pagefactory.AndroidFindBy;
import io.appium.java_client.pagefactory.AppiumFieldDecorator;
import org.apache.log4j.Logger;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.FindBy;
import org.openqa.selenium.support.PageFactory;

import java.util.List;


public class HomePage {

    private AppiumDriver localAppiumDriver;
    private MobileCommonActions mobileCommonActions;
    private static final String packageName = "com.zoomcar.debug";
    private static Logger logger = Logger.getLogger(HomePage.class);

    public HomePage(AppiumDriver driver){
        localAppiumDriver = driver;
        mobileCommonActions = new MobileCommonActions(localAppiumDriver);
        PageFactory.initElements(new AppiumFieldDecorator(localAppiumDriver),this);
    }

    @AndroidFindBy(id = packageName+":id/location_info_container")
    private WebElement locationInfoBox;

    @AndroidFindBy(id = packageName+":id/layout_start_date_time_container")
    private WebElement startDateTimeBox;

    @AndroidFindBy(id = packageName+":id/layout_end_date_time_container")
    private WebElement endDateTimeBox;

    @AndroidFindBy(id = packageName+":id/button_find_cars")
    private WebElement findCarsButton;

    @AndroidFindBy(id = packageName+":id/text_login_signup")
    private WebElement loginSignUpButton;

    @AndroidFindBy(className = "android.widget.ImageButton")
    @AndroidFindBy(accessibility = "Navigate up")
    private WebElement menuButton;

    @AndroidFindBy(id = packageName+":id/image")
    private List<WebElement> homePageWebViews;

    public LoginSignUpPage navigateToLoginSignUpPage(){
        mobileCommonActions.clickElement(menuButton);
        mobileCommonActions.clickElement(loginSignUpButton);
        return new LoginSignUpPage(localAppiumDriver);
    }

    public WebViewPage clickOnWebView(){
        mobileCommonActions.clickElement(homePageWebViews.get(3));
        logger.info("************************* Get Context Handles: "+localAppiumDriver.getContextHandles().toString());
        logger.info("************************* Get Context: "+localAppiumDriver.getContext());
        return new WebViewPage(localAppiumDriver);
    }

}

package page_objects;

import core.utils.MobileCommonActions;
import io.appium.java_client.AppiumDriver;
import io.appium.java_client.pagefactory.AndroidFindBy;
import io.appium.java_client.pagefactory.AppiumFieldDecorator;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.PageFactory;

public class HomePage {

    private AppiumDriver localAppiumDriver;
    private MobileCommonActions mobileCommonActions;
    private static final String packageName = "com.zoomcar";

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


}

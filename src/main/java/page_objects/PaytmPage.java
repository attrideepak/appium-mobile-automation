package page_objects;

import core.utils.CommonActions;
import core.utils.MobileCommonActions;
import io.appium.java_client.AppiumDriver;
import io.appium.java_client.pagefactory.AppiumFieldDecorator;
import org.openqa.selenium.support.PageFactory;

public class PaytmPage {
    private AppiumDriver localAppiumDriver;
    private MobileCommonActions mobileCommonActions;
    private CommonActions commonActions;
    private static final String packageName = "com.zoomcar.debug";

    public PaytmPage(AppiumDriver driver){
        localAppiumDriver = driver;
        mobileCommonActions = new MobileCommonActions(localAppiumDriver);
        PageFactory.initElements(new AppiumFieldDecorator(localAppiumDriver),this);
    }
}

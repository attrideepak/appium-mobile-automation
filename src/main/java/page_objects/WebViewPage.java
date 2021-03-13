package page_objects;

import core.utils.MobileCommonActions;
import io.appium.java_client.AppiumDriver;
import io.appium.java_client.pagefactory.AndroidFindBy;
import io.appium.java_client.pagefactory.AppiumFieldDecorator;
import org.apache.log4j.Logger;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.FindBy;
import org.openqa.selenium.support.PageFactory;

public class WebViewPage {
    private AppiumDriver localAppiumDriver;
    private MobileCommonActions mobileCommonActions;
    private static final String packageName = "com.zoomcar.debug";
    private static Logger logger = Logger.getLogger(WebViewPage.class);

    public WebViewPage(AppiumDriver driver) {
        localAppiumDriver = driver;
        mobileCommonActions = new MobileCommonActions(localAppiumDriver);
        PageFactory.initElements(new AppiumFieldDecorator(localAppiumDriver), this);
    }

    @AndroidFindBy(xpath = "//android.widget.ImageButton[@content-desc='Navigate up']")
    private WebElement crossButton;

    @AndroidFindBy(xpath = "//android.widget.TextView[@text='Subscribe to a Car']")
    private WebElement webPageTitle;

    //@FindBy(xpath = "android.view.View[@text='VIEW ALL CARS']")
    @FindBy(xpath = "/android.view.View[@content-desc='VIEW ALL CARS']/android.widget.Button")
    private WebElement viewAllCarsButton;

    public String getPageTitle(){
        String title = mobileCommonActions.getText(webPageTitle);
        logger.info("Context on web page: "+localAppiumDriver.getContext());
        logger.info("********** "+title+"" +" **********");
        return title;
    }

    public HomePage clickCrossButton(){
        mobileCommonActions.clickElement(crossButton);
        logger.info("Context on web page: "+localAppiumDriver.getContext());
        return new HomePage(localAppiumDriver);
    }

    public void clickViewAllCars(){
        logger.info("Context handle: "+localAppiumDriver.getContextHandles());
        mobileCommonActions.clickElement(viewAllCarsButton);
        try {
            Thread.sleep(5000);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }
}

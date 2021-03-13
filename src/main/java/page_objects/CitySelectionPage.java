package page_objects;

import core.utils.MobileCommonActions;
import io.appium.java_client.AppiumDriver;
import io.appium.java_client.MobileBy;
import io.appium.java_client.pagefactory.AndroidFindBy;
import io.appium.java_client.pagefactory.AppiumFieldDecorator;
import org.apache.log4j.Logger;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.logging.LogEntries;
import org.openqa.selenium.support.PageFactory;

import java.util.stream.StreamSupport;

public class CitySelectionPage {
    private AppiumDriver localAppiumDriver;
    private MobileCommonActions mobileCommonActions;
    private static final String packageName = "com.zoomcar.debug";
    private static Logger logger = Logger.getLogger(CitySelectionPage.class);

    public CitySelectionPage(AppiumDriver driver){
        localAppiumDriver= driver;
        mobileCommonActions = new MobileCommonActions(localAppiumDriver);
        PageFactory.initElements(new AppiumFieldDecorator(localAppiumDriver),this);
    }

    @AndroidFindBy(xpath = "//android.widget.TextView[@text='BANGALORE']")
    private WebElement banagloreCity;

    @AndroidFindBy(id = packageName+":id/image_close")
    private WebElement closeBottomSheet;

//    By city = MobileBy.xpath("//android.widget.TextView[@text='BANGALORE']");
//    By bottomSheetCloseButton = MobileBy.id( packageName+":id/image_close");


    //implement select bangalore city

    public HomePage selectCityAndNaviagteToHomePage(){
        mobileCommonActions.clickElement(banagloreCity);
        mobileCommonActions.clickElement(closeBottomSheet);
        try {
            Thread.sleep(2000);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }

        return new HomePage(localAppiumDriver);
    }

    public HomePage closeBottomSheet(){
        mobileCommonActions.clickElement(closeBottomSheet);
        logger.info("************************* Get context handles: "+localAppiumDriver.getContextHandles().toString());
        logger.info("************************* Get Context: "+localAppiumDriver.getContext());
        return new HomePage(localAppiumDriver);
    }

//    public HomePage closeBottomSheet(){
//        mobileCommonActions.clickElement(this.driver.findElement(bottomSheetCloseButton));
//        return new HomePage(this.driver);
//    }
}

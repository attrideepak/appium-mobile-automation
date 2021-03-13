package Android;

import base_test.BaseTest;
import core.utils.MobileCommonActions;
import io.appium.java_client.AppiumDriver;
import org.apache.log4j.Logger;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;
import page_objects.AppLaunchPage;
import page_objects.CitySelectionPage;
import page_objects.HomePage;
import page_objects.LocationAccessPage;

public class WebViewTest extends BaseTest {
    private AppLaunchPage appLaunchPage;
    private LocationAccessPage locationAccessPage;
    private CitySelectionPage citySelectionPage;
    private HomePage homePage;
    private MobileCommonActions mobileCommonActions;

    private AppiumDriver localAppiumDriver;
    private static Logger logger = Logger.getLogger(WebViewTest.class);

    @BeforeClass
    public void beforeClass(){
        localAppiumDriver = (AppiumDriver) super.driver;
        appLaunchPage = new AppLaunchPage(localAppiumDriver);
        locationAccessPage = new LocationAccessPage(localAppiumDriver);
        citySelectionPage = new CitySelectionPage(localAppiumDriver);
        mobileCommonActions = new MobileCommonActions(localAppiumDriver);
        homePage = new HomePage(localAppiumDriver);
    }

    @Test
    public void navigateWebViewTest(){
        citySelectionPage.closeBottomSheet().clickOnWebView().clickViewAllCars();

        try {
            Thread.sleep(5000);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }
}

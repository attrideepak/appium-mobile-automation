package Android;

import base_test.BaseTest;
import core.utils.LogcatUtils;
import core.utils.MobileCommonActions;
import io.appium.java_client.AppiumDriver;
import io.appium.java_client.android.AndroidDriver;
import org.apache.log4j.Logger;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Listeners;
import org.testng.annotations.Test;
import page_objects.AppLaunchPage;
import page_objects.CitySelectionPage;
import page_objects.HomePage;
import page_objects.LocationAccessPage;

//@Listeners(BaseTest.class)
public class AppLaunchTest extends BaseTest {
    private AppLaunchPage appLaunchPage;
    private LocationAccessPage locationAccessPage;
    private CitySelectionPage citySelectionPage;
    private HomePage homePage;
    private MobileCommonActions mobileCommonActions;

    private AppiumDriver localAppiumDriver;
    private static Logger logger = Logger.getLogger(AppLaunchTest.class);

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
    public void launchAppAndNavigateToHomePage(){

        appLaunchPage.navigateToLocationAccessPage().clickCrossButton().selectCityAndNaviagteToHomePage();
    }

    @Test
    public void launchHomePage(){

        citySelectionPage.closeBottomSheet();
    }
}

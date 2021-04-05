package Android;

import base_test.BaseTest;
import core.utils.LogcatUtils;
import core.utils.MobileCommonActions;
import io.appium.java_client.AppiumDriver;
import io.appium.java_client.android.AndroidDriver;
import io.appium.java_client.ios.IOSDriver;
import org.apache.log4j.Logger;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;
import page_objects.*;

public class LoginTest extends BaseTest {

   // private AppLaunchPage appLaunchPage;
   // private LocationAccessPage locationAccessPage;
    private CitySelectionPage citySelectionPage;
    private HomePage homePage;
    private MobileCommonActions mobileCommonActions;
    private LoginSignUpPage loginSignUpPage;

    private AppiumDriver localAppiumDriver;
    private static Logger logger = Logger.getLogger(LoginTest.class);

    @BeforeClass
    public void beforeClass(){
        localAppiumDriver = (AppiumDriver) super.driver;
      //  appLaunchPage = new AppLaunchPage(localAppiumDriver);
      //  locationAccessPage = new LocationAccessPage(localAppiumDriver);
        citySelectionPage = new CitySelectionPage(localAppiumDriver);
        mobileCommonActions = new MobileCommonActions(localAppiumDriver);
        homePage = new HomePage(localAppiumDriver);
        loginSignUpPage = new LoginSignUpPage(localAppiumDriver);
    }

    @Test
    public void loginTest(){
        LogcatUtils.getFirstNLinesofLogcats(200,localAppiumDriver);
        citySelectionPage.closeBottomSheet().navigateToLoginSignUpPage().loginWithEmail();
        try {
            Thread.sleep(5000);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
       
        LogcatUtils.getFirstNLinesofLogcats(200,localAppiumDriver);



    }

}

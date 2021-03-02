package Android;

import base_test.BaseTest;
import io.appium.java_client.AppiumDriver;
import io.appium.java_client.android.AndroidDriver;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Listeners;
import org.testng.annotations.Test;
import page_objects.AppLaunchPage;

//@Listeners(BaseTest.class)
public class AppLaunchTest extends BaseTest {
    private AppLaunchPage appLaunchPage;
    private AppiumDriver localAppiumDriver;

    @BeforeClass
    public void beforeClass(){
        localAppiumDriver = (AndroidDriver)super.driver;
        appLaunchPage = new AppLaunchPage(localAppiumDriver);
    }

    @Test
    public void launchApp(){
        appLaunchPage.navigateToCitySelectionPage();
    }
}

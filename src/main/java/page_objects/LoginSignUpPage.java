package page_objects;

import core.utils.CommonActions;
import core.utils.LogcatUtils;
import core.utils.MobileCommonActions;
import io.appium.java_client.AppiumDriver;
import io.appium.java_client.pagefactory.AndroidFindBy;
import io.appium.java_client.pagefactory.AppiumFieldDecorator;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.PageFactory;

public class LoginSignUpPage {

    private AppiumDriver localAppiumDriver;
    private MobileCommonActions mobileCommonActions;
    private CommonActions commonActions;
    private static final String packageName = "com.zoomcar.debug";
    private static String email = "deepak.attri@zoomcar.com";
    private static String password = "password";

    public LoginSignUpPage(AppiumDriver driver){
        localAppiumDriver = driver;
        mobileCommonActions = new MobileCommonActions(localAppiumDriver);
        PageFactory.initElements(new AppiumFieldDecorator(localAppiumDriver),this);
    }

    @AndroidFindBy(id = packageName+":id/edit_association")
    private WebElement emailEditBox;

    @AndroidFindBy(id = packageName+":id/edit_password")
    private WebElement passwordEditBox;

    @AndroidFindBy(id = packageName+":id/auth_continue_button")
    private WebElement continueButton;

    public PaytmPage loginWithEmail(){
        mobileCommonActions.clickElement(emailEditBox);
        mobileCommonActions.enterText(emailEditBox,email);
        mobileCommonActions.clickElement(continueButton);
        mobileCommonActions.enterText(passwordEditBox,password);
        mobileCommonActions.clickElement(continueButton);
        try {
            Thread.sleep(10000);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        return new PaytmPage(localAppiumDriver);

    }



}

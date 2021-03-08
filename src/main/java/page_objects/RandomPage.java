package page_objects;

import core.utils.MobileCommonActions;
import io.appium.java_client.AppiumDriver;
import io.appium.java_client.pagefactory.AndroidFindBy;
import io.appium.java_client.pagefactory.AppiumFieldDecorator;
import org.apache.log4j.Logger;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.PageFactory;

public class RandomPage {
    //private static Logger logger = Logger.getLogger(RandomPage.class);
    int x;
    int y;

    //private static String name = "DEEPAK";



    public RandomPage(int f, int g) {
        x  = f;
        y = g;
        System.out.println("This is constructor");
    }

    int a = x+y;

    public void getSum(){
        System.out.println("Sum "+(x+y));
    }

}

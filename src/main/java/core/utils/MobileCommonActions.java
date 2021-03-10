package core.utils;

import com.google.common.collect.ImmutableMap;
import core.constants.Constants;
import io.appium.java_client.AppiumDriver;
import io.appium.java_client.MobileBy;
import io.appium.java_client.TouchAction;
import io.appium.java_client.android.AndroidDriver;
import io.appium.java_client.android.AndroidMobileCommandHelper;
import io.appium.java_client.android.AndroidStartScreenRecordingOptions;
import io.appium.java_client.android.nativekey.AndroidKey;
import io.appium.java_client.android.nativekey.KeyEvent;
import io.appium.java_client.android.nativekey.KeyEventMetaModifier;
import io.appium.java_client.touch.WaitOptions;
import io.appium.java_client.touch.offset.PointOption;
import org.apache.log4j.Logger;
import org.openqa.selenium.*;
import org.openqa.selenium.html5.Location;

import java.io.IOException;
import java.time.Duration;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Map;

import static io.appium.java_client.touch.LongPressOptions.longPressOptions;
import static io.appium.java_client.touch.TapOptions.tapOptions;
import static io.appium.java_client.touch.offset.ElementOption.element;
import static java.time.Duration.ofMillis;
import static java.time.Duration.ofSeconds;

public class MobileCommonActions extends CommonActions {
    public AppiumDriver localAppiumDriver;

    String packageName = Constants.PACKAGE_NAME.DEBUG_PACKAGE.getPackageName();

    private static Logger logger = Logger.getLogger(MobileCommonActions.class);


   public int getPackageId(){
       List<String> args = Arrays.asList(
               "-s",
               packageName
       );

       Map<String, Object> cmd = ImmutableMap.of(
               "command", "pidof",
               "args", args
       );

       String pid = (String) localAppiumDriver.executeScript("mobile: shell", cmd);
       int packageId = Integer.parseInt(pid.replace("\n", ""));
       return packageId;
   }

    public MobileCommonActions(WebDriver localAppiumDriver) {
        super(localAppiumDriver);
        this.localAppiumDriver = (AppiumDriver) localAppiumDriver;
    }

    public void clickElement(WebElement myElement) {
        waitForElementToBeClickable(myElement);
        try {
            myElement.click();
        } catch (Exception e) {
           // takeScreenShot();
            throw new RuntimeException(e);
        }
    }

    public WebElement scrollHorizontallyToElementUsingText(
            String scrollableListResourceId, String text) {

        WebElement element =
                this.localAppiumDriver.findElement(
                        MobileBy.AndroidUIAutomator(
                                "new UiScrollable(new UiSelector().resourceId(\""
                                        + scrollableListResourceId
                                        + "\")).setAsHorizontalList().scrollIntoView("
                                        + "new UiSelector().text(\""
                                        + text
                                        + "\"))"));
        return element;
    }

    public WebElement scrollToElementUsingText(
            String scrollableListResourceId, String uiSelectorClassName, String text) {
        try {
            WebElement element =
                    ((AndroidDriver) this.localAppiumDriver)
                            .findElementByAndroidUIAutomator(
                                    "new UiScrollable(new UiSelector().resourceId(\""
                                            + scrollableListResourceId
                                            + "\")).getChildByText("
                                            + "new UiSelector().className(\""
                                            + uiSelectorClassName
                                            + "\"), \""
                                            + text
                                            + "\")");
            return element;
        } catch (Exception e) {
           // takeScreenShot();
            throw new RuntimeException(e);
        }
    }
    public WebElement scrollToElementUsingText(
            String scrollableListResourceId, String text, int maxNumberOfSwipes) {
        try {
            WebElement element =
                    this.localAppiumDriver.findElement(
                            MobileBy.AndroidUIAutomator(
                                    "new UiScrollable(new UiSelector().resourceId(\""
                                            + scrollableListResourceId
                                            + "\")).setMaxSearchSwipes("
                                            + maxNumberOfSwipes
                                            + ").scrollIntoView("
                                            + "new UiSelector().text(\""
                                            + text
                                            + "\"))"));
            return element;
        } catch (Exception e) {
           // takeScreenShot();
            throw new RuntimeException(e);
        }
    }

    public WebElement scrollToElementUsingContentDescription(
            String scrollableListResourceId, String uiSelectorClassName, String contentDesc) {
        try {
            WebElement element =
                    this.localAppiumDriver.findElement(
                            MobileBy.AndroidUIAutomator(
                                    "new UiScrollable(new UiSelector().resourceId(\""
                                            + scrollableListResourceId
                                            + "\")).getChildByDescription("
                                            + "new UiSelector().className(\""
                                            + uiSelectorClassName
                                            + "\"), \""
                                            + contentDesc
                                            + "\")"));

            return element;
        } catch (Exception e) {
            //takeScreenShot();
            throw new RuntimeException(e);
        }
    }

    public WebElement scrollHorizontallyToElementUsingContentDescription(
            String scrollableListResourceId, String contentDesc) {
        try {
            WebElement element =
                    this.localAppiumDriver.findElement(
                            MobileBy.AndroidUIAutomator(
                                    "new UiScrollable(new UiSelector().resourceId(\""
                                            + scrollableListResourceId
                                            + "\")).setAsHorizontalList().scrollIntoView("
                                            + "new UiSelector().description(\""
                                            + contentDesc
                                            + "\"))"));

            return element;
        } catch (Exception e) {
            //takeScreenShot();
            throw new RuntimeException(e);
        }
    }

    public WebElement scrollToElementUsingContentDescription(
            String scrollableListResourceId, String text) {
        try {
            WebElement element =
                    this.localAppiumDriver.findElement(
                            MobileBy.AndroidUIAutomator(
                                    "new UiScrollable(new UiSelector().resourceId(\""
                                            + scrollableListResourceId
                                            + "\")).scrollIntoView("
                                            + "new UiSelector().description(\""
                                            + text
                                            + "\"))"));
            return element;
        } catch (Exception e) {
           // takeScreenShot();
            throw new RuntimeException(e);
        }
    }

    public WebElement findNthOccuranceOfElementUsingPartialText(
            String scrollableListResourceId, String partialText, int occurrence) {
        try {

            WebElement element =
                    this.localAppiumDriver.findElement(
                            MobileBy.AndroidUIAutomator(
                                    "new UiScrollable(new UiSelector().resourceId(\""
                                            + scrollableListResourceId
                                            + "\")).scrollIntoView("
                                            + "new UiSelector().textContains(\""
                                            + partialText
                                            + "\").instance("
                                            + occurrence
                                            + "))"));

            return element;
        } catch (Exception e) {
           // takeScreenShot();
            throw new RuntimeException(e);
        }
    }

    public WebElement findNthOccuranceOfElementUsingText(
            String scrollableListResourceId, String text, int occurrence) {
        try {
            WebElement element =
                    this.localAppiumDriver.findElement(
                            MobileBy.AndroidUIAutomator(
                                    "new UiScrollable(new UiSelector().resourceId(\""
                                            + scrollableListResourceId
                                            + "\")).scrollIntoView("
                                            + "new UiSelector().text(\""
                                            + text
                                            + "\").instance("
                                            + occurrence
                                            + "))"));

            return element;
        } catch (Exception e) {
           // takeScreenShot();
            throw new RuntimeException(e);
        }
    }

    public enum Scroll {
        DOWN("down"),
        UP("up"),
        CENTER("center"),
        RIGHT("right"),
        LEFT("left");
        String value;

        Scroll(String value) {
            this.value = value;
        }

        public String getValue() {
            return value;
        }
    }

    public enum Tap {
        TOP("top"),
        BOTTOM("bottom"),
        CENTER("center"),
        RIGHT("right"),
        LEFT("left");
        String value;

        Tap(String value) {
            this.value = value;
        }

        public String getValue() {
            return value;
        }
    }

    private void scrollInAnyDirection(Scroll direction){
        try {
            TouchAction action = new TouchAction(localAppiumDriver);
            int height;
            int width;

            height = this.localAppiumDriver.manage().window().getSize().getHeight();
            width = this.localAppiumDriver.manage().window().getSize().getWidth();

            int startX, startY, endX, endY;

            switch (direction) {
                case UP:
                    startX = width / 2;
                    startY = (int) (height * 0.2); // starting from 20% of the height
                    endX = width / 2;
                    endY = (int) (height * 0.8); // ending to 80% of the height
                    logger.debug("start - x : " + startX + ", y : " + startY);
                    logger.debug("end - x : " + endX + ", y : " + endX);
                    action
                            .press(new PointOption().point(startX, startY))
                            .waitAction(new WaitOptions().withDuration(ofSeconds(1)))
                            .moveTo(new PointOption().point(endX, endY))
                            .release()
                            .perform();
                    logger.info("Swiping up done!");
                    break;

                case DOWN:
                    startX = width / 2;
                    startY = (int) (height * 0.8); // starting from 80% of the height
                    endX = width / 2;
                    endY = (int) (height * 0.2); // ending to 20% of the height
                    logger.debug("start - x : " + startX + ", y : " + startY);
                    logger.debug("end - x : " + endX + ", y : " + endX);
                    action
                            .press(new PointOption().point(startX, startY))
                            .waitAction(new WaitOptions().withDuration(ofSeconds(1)))
                            .moveTo(new PointOption().point(endX, endY))
                            .release()
                            .perform();
                    logger.info("Swiping down done!");
                    break;

                case LEFT:
                    startX = (int) (width * 0.8); // starting from 80% of the width
                    startY = height / 2;
                    endX = (int) (width * 0.2); // ending to 20% of the width
                    endY = height / 2;
                    logger.debug("start - x : " + startX + ", y : " + startY);
                    logger.debug("end - x : " + endX + ", y : " + endX);
                    action
                            .press(new PointOption().point(startX, startY))
                            .waitAction(new WaitOptions().withDuration(ofSeconds(1)))
                            .moveTo(new PointOption().point(endX, endY))
                            .release()
                            .perform();
                    logger.info("Swiping left done!");
                    break;

                case RIGHT:
                    startX = (int) (width * 0.2); // starting from 80% of the width
                    startY = height / 2;
                    endX = (int) (width * 0.2); // ending to 20% of the width
                    endY = height / 2;
                    logger.debug("start - x : " + startX + ", y : " + startY);
                    logger.debug("end - x : " + endX + ", y : " + endX);
                    action
                            .press(new PointOption().point(startX, startY))
                            .waitAction(new WaitOptions().withDuration(ofSeconds(1)))
                            .moveTo(new PointOption().point(endX, endY))
                            .release()
                            .perform();
                    logger.info("Swiping right done!");
                    break;

                default:
                    logger.info("Invalid scroll direction");
                    break;
            }
        } catch (Exception e) {
           // takeScreenShot();
            throw new RuntimeException(e);
        }
    }

    /**
     * this methed scroll with in the location of given element
     *
     * @param direction left right center/centre top bottom
     * @param element WebElement
     */

    public void scrollInAnyDirectionWithinElement(String direction, WebElement element) {
        try {
            Point pointLeft =
                    new Point(
                            (int) (element.getLocation().getX() * 1.05f),
                            (int) (element.getLocation().getY() * 1.05f));
            Point pointRight =
                    new Point(
                            (int) ((pointLeft.getX() + element.getSize().getWidth()) * 0.95f), pointLeft.getY());
            Point pointCenter =
                    new Point(
                            (pointLeft.getX() + pointRight.getX()) / 2,
                            (element.getSize().getHeight() + element.getLocation().getY() * 2) / 2);
            Point pointTop = new Point(pointCenter.getX(), pointLeft.getY());
            Point pointBottom =
                    new Point(
                            pointCenter.getX(),
                            (int) (((pointLeft.getY() + element.getSize().getHeight()) * 0.95f)));
            TouchAction touchAction = new TouchAction(localAppiumDriver);
            if (direction.equalsIgnoreCase(Tap.LEFT.getValue())) {
                logger.debug(
                        "Swiping Left " + pointLeft.toString() + " to Right : " + pointRight.toString());
                touchAction
                        .longPress(
                                longPressOptions()
                                        .withPosition(PointOption.point(pointLeft))
                                        .withDuration(ofMillis(500)))
                        .moveTo(PointOption.point(pointRight))
                        .release()
                        .perform();
            } else if (direction.equalsIgnoreCase(Tap.RIGHT.getValue())) {
                logger.debug(
                        "Swiping Right " + pointRight.toString() + " to Left : " + pointLeft.toString());
                touchAction
                        .longPress(
                                longPressOptions()
                                        .withPosition(PointOption.point(pointRight))
                                        .withDuration(ofMillis(500)))
                        .moveTo(PointOption.point(pointLeft))
                        .release()
                        .perform();
            } else if (direction.equalsIgnoreCase(Tap.CENTER.getValue())
                    || direction.equalsIgnoreCase("centre")) {
                logger.debug(
                        "Swiping top " + pointCenter.toString() + " to center : " + pointCenter.toString());
                touchAction
                        .longPress(
                                longPressOptions()
                                        .withPosition(PointOption.point(pointTop))
                                        .withDuration(ofMillis(500)))
                        .moveTo(PointOption.point(pointCenter))
                        .release()
                        .perform();
            } else if (direction.equalsIgnoreCase(Tap.TOP.getValue())) {
                logger.debug(
                        "Swiping center " + pointCenter.toString() + " to top : " + pointTop.toString());
                touchAction
                        .longPress(
                                longPressOptions()
                                        .withPosition(PointOption.point(pointCenter))
                                        .withDuration(ofMillis(500)))
                        .moveTo(PointOption.point(pointTop))
                        .release()
                        .perform();
            } else if (direction.equalsIgnoreCase(Tap.BOTTOM.getValue())) {
                logger.debug(
                        "Swiping center " + pointCenter.toString() + " to bottom : " + pointBottom.toString());
                touchAction
                        .longPress(
                                longPressOptions()
                                        .withPosition(PointOption.point(pointCenter))
                                        .withDuration(ofMillis(500)))
                        .moveTo(PointOption.point(pointBottom))
                        .release()
                        .perform();
            } else logger.info("Invalid tap location");
        } catch (Exception e) {
           // takeScreenShot();
            throw new RuntimeException(e);
        }
    }

    /**
     * this method will tap within element right corner, left corner, center
     *
     * @param element WebElement
     * @param direction up,down,center,bottom, right, left
     */
    public void tapWithinElement(WebElement element, String direction) {
        try {
            Point pointLeft =
                    new Point(
                            (int) (element.getLocation().getX() * 1.05f),
                            (int) (element.getLocation().getY() * 1.05f));
            Point pointRight =
                    new Point(
                            (int) ((pointLeft.getX() + element.getSize().getWidth()) * 0.95f), pointLeft.getY());
            Point pointCenter =
                    new Point(
                            (pointLeft.getX() + pointRight.getX()) / 2,
                            (element.getSize().getHeight() + element.getLocation().getY() * 2) / 2);
            Point pointTop = new Point(pointCenter.getX(), pointLeft.getY());
            Point pointBottom =
                    new Point(
                            pointCenter.getX(),
                            (int) (((pointLeft.getY() + element.getSize().getHeight()) * 0.95f)));
            TouchAction touchAction = new TouchAction(localAppiumDriver);
            if (direction.equalsIgnoreCase(Tap.LEFT.getValue())) {
                logger.info("tap left");
                touchAction
                        .tap(PointOption.point(pointLeft))
                        .waitAction(WaitOptions.waitOptions(Duration.ofMillis(250)))
                        .perform();
            } else if (direction.equalsIgnoreCase(Tap.RIGHT.getValue())) {
                logger.info("tap right");
                touchAction
                        .tap(PointOption.point(pointRight))
                        .waitAction(WaitOptions.waitOptions(Duration.ofMillis(250)))
                        .perform();
            } else if (direction.equalsIgnoreCase(Tap.CENTER.getValue())
                    || direction.equalsIgnoreCase("centre")) {
                logger.info("tap center");
                touchAction
                        .tap(PointOption.point(pointCenter))
                        .waitAction(WaitOptions.waitOptions(Duration.ofMillis(250)))
                        .perform();
            } else if (direction.equalsIgnoreCase(Tap.TOP.getValue())) {
                logger.info("tap top : " + pointTop.toString());
                touchAction
                        .tap(PointOption.point(pointTop))
                        .waitAction(WaitOptions.waitOptions(Duration.ofMillis(250)))
                        .perform();
            } else if (direction.equalsIgnoreCase(Tap.BOTTOM.getValue())) {
                logger.info("tap bottom : " + pointBottom.toString());
                touchAction
                        .tap(PointOption.point(pointBottom))
                        .waitAction(WaitOptions.waitOptions(Duration.ofMillis(250)))
                        .perform();
            } else logger.info("Invalid tap location");
        } catch (Exception e) {
           // takeScreenShot();
            throw new RuntimeException(e);
        }
    }

    public void scrollTillElementVertically(By myElement) {
        try {
            List<WebElement> elements = this.localAppiumDriver.findElements(myElement);
            while (elements.size() == 0) {
                scrollInAnyDirection(Scroll.DOWN);
                elements = this.localAppiumDriver.findElements(myElement);
            }
        } catch (Exception e) {
           // takeScreenShot();
            throw new RuntimeException(e);
        }
    }

    public void scrollTillElementVertically(By myElement, int maxSwipe) {
        List<WebElement> elements = this.localAppiumDriver.findElements(myElement);
        while (elements.size() == 0 && maxSwipe-- > 0) {
            scrollInAnyDirection(Scroll.DOWN);
            elements = this.localAppiumDriver.findElements(myElement);
        }
    }

    public void scrollTillElementHorizontally(By myElement) {
        try {
            List<WebElement> elements = this.localAppiumDriver.findElements(myElement);

            while (elements.size() == 0) {
                scrollInAnyDirection(Scroll.LEFT);
                elements = this.localAppiumDriver.findElements(myElement);
            }
        } catch (Exception e) {
           // takeScreenShot();
            throw new RuntimeException(e);
        }
    }

    public void bringAppInForeground(String packageName) {
        try {
            this.localAppiumDriver.activateApp(packageName);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public void tapElement(WebElement myElement) {
        try {
            TouchAction t = new TouchAction(this.localAppiumDriver);
            t.tap(tapOptions().withElement(element(myElement))).perform();
        } catch (Exception e) {
            //takeScreenShot();
            throw new RuntimeException(e);
        }
    }

    public void longPressOnElement(WebElement myElement) {
        try {
            TouchAction t = new TouchAction(this.localAppiumDriver);
            t.longPress(longPressOptions().withElement(element(myElement))).release().perform();
        } catch (Exception e) {
           // takeScreenShot();
            throw new RuntimeException(e);
        }
    }

    public void longPressOnElement(WebElement myElement, long durationInSeconds) {
        try {
            TouchAction t = new TouchAction(this.localAppiumDriver);
            t.longPress(
                    longPressOptions()
                            .withElement(element(myElement))
                            .withDuration(ofSeconds(durationInSeconds)))
                    .release()
                    .perform();
        } catch (Exception e) {
            //takeScreenShot();
            throw new RuntimeException(e);
        }
    }

    public void swipeFromOneElementToAnother(WebElement firstElement, WebElement secondElement) {
        try {
            TouchAction t = new TouchAction(this.localAppiumDriver);
            t.longPress(longPressOptions().withElement(element(firstElement)).withDuration(ofSeconds(1)))
                    .moveTo(element(secondElement))
                    .release()
                    .perform();
        } catch (Exception e) {
            //takeScreenShot();
            throw new RuntimeException(e);
        }
    }

    public void dragAndDropElement(WebElement source, WebElement destination) {
        try {
            TouchAction t = new TouchAction(this.localAppiumDriver);

            t.longPress(element(source)).moveTo(element(destination)).release().perform();
        } catch (Exception e) {
            //takeScreenShot();
            throw new RuntimeException(e);
        }
    }

    public void pressAndroidNativeKeys(AndroidKey keyToPress) {
        ((AndroidDriver) this.localAppiumDriver).pressKey(new KeyEvent().withKey(keyToPress));
    }

    public void pressAndroidNativeKeyWithModifier(
            KeyEventMetaModifier keyEventMetaModifier, AndroidKey keyToPress) {
        ((AndroidDriver) this.localAppiumDriver)
                .pressKey(new KeyEvent().withMetaModifier(keyEventMetaModifier).withKey(keyToPress));
    }

    public void setDeviceLocation(double lat, double lng) {
        localAppiumDriver.setLocation(new Location(lat, lng, 0));
    }

    public void pressBackButton() {
        localAppiumDriver.navigate().back();
    }

    public boolean isEnabled(WebElement myElement) {
        boolean enabled = false;

        try {
            enabled = myElement.isEnabled();
        } catch (Exception e) {
            logger.error("issue finding element");
            //takeScreenShot();
        }
        return enabled;
    }

    public boolean isChecked(WebElement myElement) {
        boolean checked = false;

        try {
            checked = Boolean.parseBoolean(myElement.getAttribute("checked"));
        } catch (Exception e) {
            logger.error("issue finding element attribute checked");
            //takeScreenShot();
        }
        return checked;
    }

    public boolean isCheckable(WebElement myElement) {
        boolean checkable = false;

        try {
            checkable = Boolean.parseBoolean(myElement.getAttribute("checkable"));
        } catch (Exception e) {
            logger.error("issue finding element attribute checkable");
            //takeScreenShot();
        }
        return checkable;
    }

    public void startScreenRecord(AndroidDriver androidDriver) {
        try {
            androidDriver.startRecordingScreen(
                    new AndroidStartScreenRecordingOptions().withTimeLimit(Duration.ofMinutes(15)));
            logger.info("screen record started");
        } catch (Exception e) {
            logger.error(e.getMessage());
        }
    }

  //  @Attachment(value = "ScreenRecord video", type = "video/mp4")
    public byte[] stopScreenRecord(AndroidDriver androidDriver) {
        try {
            Thread.sleep(1000);
            String video = androidDriver.stopRecordingScreen();
            logger.info("screen record stopped");
            return Base64.getMimeDecoder().decode(video);
        } catch (Exception e) {
            logger.error(e.getMessage());
        }
        return null;
    }

    public static void removeAndroidApps(String appName, boolean onlyApp) {
        CommandUtils commandUtils = new CommandUtils();
        try {
            if (!onlyApp) {
                commandUtils.executeCommand("adb uninstall io.appium.uiautomator2.server");
                commandUtils.executeCommand("adb uninstall io.appium.uiautomator2.server.test");
                commandUtils.executeCommand("adb uninstall io.appium.unlock");
                commandUtils.executeCommand("adb uninstall io.appium.settings");
                logger.info("uninstalled appium files from devcie");
            }
            logger.info(
                    "remove "
                            + appName
                            + " app : "
                            + commandUtils.executeCommand(
                            "adb uninstall "
                                    + "com.zoomcar"));
        } catch (InterruptedException e) {
            logger.error(e.getMessage());
        } catch (IOException e) {
            logger.error(e.getMessage());
        }
    }

    public static String getAndroidAppVersion(String device, String packageName) {
        try {
            CommandUtils commandUtils = new CommandUtils();
            return commandUtils
                    .executeCommand(
                            "adb -s " + device + " shell dumpsys package " + packageName + " | grep versionName")
                    .trim()
                    .split("=")[1];
        } catch (InterruptedException e) {
            logger.error(e.getMessage());
        } catch (IOException e) {
            logger.error(e.getMessage());
        }
        return null;
    }



}

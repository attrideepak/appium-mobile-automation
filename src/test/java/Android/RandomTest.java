package Android;

import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;
import page_objects.RandomPage;

public class RandomTest {
    RandomPage randomPage;
    int p =5;
    int q =10;

    @BeforeClass
    public void beforeClass(){
        randomPage = new RandomPage(5,10);
    }

    @Test
    public void rTest(){
        randomPage.getSum();
    }

}

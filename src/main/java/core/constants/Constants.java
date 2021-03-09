package core.constants;

public enum  Constants {
    ;

    public enum PACKAGE_NAME{
        PROD_PACKAGE("com.zoomcar"),
        DEBUG_PACKAGE("com.zoomcar.debug");

        String packageName;

        PACKAGE_NAME(String packageName){
            this.packageName = packageName;
        }

        public String getPackageName(){
            return getPackageName();
        }

    }


}

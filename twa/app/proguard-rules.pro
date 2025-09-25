# GlobalTaxCalc TWA ProGuard Rules

# Keep all TWA-related classes
-keep class com.google.androidbrowserhelper.** { *; }
-keep class androidx.browser.** { *; }

# Keep WebView classes
-keep class android.webkit.** { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep Custom Tabs classes
-keep class androidx.browser.customtabs.** { *; }

# Keep file provider classes
-keep class androidx.core.content.FileProvider { *; }

# Keep notification classes
-keep class androidx.core.app.NotificationCompat** { *; }

# Keep lifecycle classes
-keep class androidx.lifecycle.** { *; }

# Preserve line numbers for debugging
-keepattributes SourceFile,LineNumberTable

# Preserve annotations
-keepattributes *Annotation*

# Keep custom application class if any
-keep public class * extends android.app.Application

# Keep services
-keep public class * extends android.app.Service

# Keep broadcast receivers
-keep public class * extends android.content.BroadcastReceiver

# Optimize but don't remove logging in debug builds
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int d(...);
    public static int i(...);
    public static int w(...);
    public static int e(...);
}

# Optimization settings
-optimizations !code/simplification/arithmetic,!field/*,!class/merging/*,!code/allocation/variable

# Remove unnecessary metadata
-keepattributes !LocalVariableTable,!LocalVariableTypeTable

# Keep enum classes
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Keep Parcelable classes
-keep class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}

# Keep Serializable classes
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep classes with special naming conventions
-keepclasseswithmembernames class * {
    public <init>(android.content.Context, android.util.AttributeSet);
}

-keepclasseswithmembernames class * {
    public <init>(android.content.Context, android.util.AttributeSet, int);
}

# Keep onClick methods
-keepclassmembers class * extends android.app.Activity {
    public void *(android.view.View);
}

# TWA-specific optimizations
-keep class com.globaltaxcalc.app.** { *; }

# If using any third-party libraries, add their specific rules here
# Example for popular libraries:

# Gson (if used for JSON processing)
# -keep class com.google.gson.** { *; }
# -keepattributes Signature
# -keepattributes *Annotation*

# OkHttp (if used for networking)
# -dontwarn okhttp3.**
# -dontwarn okio.**

# Keep any custom model classes
-keep class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# Additional TWA-specific rules
-dontwarn com.google.androidbrowserhelper.**
-dontwarn androidx.browser.**

# Keep intent filters working properly
-keep class * extends android.content.BroadcastReceiver {
    public <init>(...);
}

# Preserve stack traces for crash reporting
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
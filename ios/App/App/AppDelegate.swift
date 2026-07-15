import UIKit
import Capacitor
import GoogleMobileAds

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    private let appOpenAds = DuoBibliaAppOpenAdManager()

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let defaults = UserDefaults.standard
        defaults.set(defaults.integer(forKey: "duobiblia_launch_count") + 1, forKey: "duobiblia_launch_count")
        MobileAds.shared.start(completionHandler: nil)
        appOpenAds.loadAd()

        if let bridgeController = window?.rootViewController as? CAPBridgeViewController {
            bridgeController.loadViewIfNeeded()
            bridgeController.bridge?.registerPluginInstance(PremiumStatePlugin())
            bridgeController.bridge?.registerPluginInstance(VerseSharePlugin())
        }
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        appOpenAds.showIfAvailable(from: window?.rootViewController)
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

@objc(VerseSharePlugin)
public class VerseSharePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "VerseSharePlugin"
    public let jsName = "VerseShare"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "shareImage", returnType: CAPPluginReturnPromise)
    ]

    @objc func shareImage(_ call: CAPPluginCall) {
        guard
            let encoded = call.getString("base64"),
            let data = Data(base64Encoded: encoded),
            let image = UIImage(data: data)
        else {
            call.reject("La imagen del versículo está vacía")
            return
        }

        let text = call.getString("text") ?? "DuoBiblia"
        DispatchQueue.main.async { [weak self] in
            guard let self, let presenter = self.bridge?.viewController else {
                call.reject("No se pudo abrir el menú para compartir")
                return
            }
            let activity = UIActivityViewController(activityItems: [image, text], applicationActivities: nil)
            if let popover = activity.popoverPresentationController {
                popover.sourceView = presenter.view
                popover.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.maxY - 1, width: 1, height: 1)
            }
            presenter.present(activity, animated: true) { call.resolve() }
        }
    }
}

@objc(PremiumStatePlugin)
public class PremiumStatePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PremiumStatePlugin"
    public let jsName = "PremiumState"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setPremium", returnType: CAPPluginReturnPromise)
    ]

    @objc func setPremium(_ call: CAPPluginCall) {
        UserDefaults.standard.set(call.getBool("premium") ?? false, forKey: "duobiblia_premium")
        call.resolve()
    }
}

private final class DuoBibliaAppOpenAdManager: NSObject, FullScreenContentDelegate {
    #if DEBUG
    private let adUnitID = "ca-app-pub-3940256099942544/5575463023"
    #else
    private let adUnitID = "ca-app-pub-8007313797348394/7027019877"
    #endif

    private let fourHours: TimeInterval = 4 * 60 * 60
    private let testCooldown: TimeInterval = 30 * 60
    private var appOpenAd: AppOpenAd?
    private var loadedAt: Date?
    private var isLoading = false
    private var isShowing = false

    func loadAd() {
        guard !isPremium, !isLoading, !isAvailable else { return }
        isLoading = true
        AppOpenAd.load(with: adUnitID, request: Request()) { [weak self] ad, error in
            guard let self else { return }
            self.isLoading = false
            guard error == nil, let ad else {
                self.appOpenAd = nil
                return
            }
            self.appOpenAd = ad
            self.loadedAt = Date()
            ad.fullScreenContentDelegate = self
        }
    }

    func showIfAvailable(from rootController: UIViewController?) {
        guard !isPremium else {
            appOpenAd = nil
            return
        }
        guard UserDefaults.standard.integer(forKey: "duobiblia_launch_count") >= 3 else {
            loadAd()
            return
        }
        let lastShown = UserDefaults.standard.object(forKey: "duobiblia_last_app_open_ad") as? Date
        #if DEBUG
        let cooldown = testCooldown
        #else
        let cooldown = fourHours
        #endif
        guard lastShown == nil || Date().timeIntervalSince(lastShown!) >= cooldown else { return }

        guard !isShowing, let ad = appOpenAd, let presenter = topController(from: rootController) else {
            loadAd()
            return
        }
        isShowing = true
        UserDefaults.standard.set(Date(), forKey: "duobiblia_last_app_open_ad")
        ad.present(from: presenter)
    }

    private var isPremium: Bool {
        UserDefaults.standard.bool(forKey: "duobiblia_premium")
    }

    private var isAvailable: Bool {
        guard appOpenAd != nil, let loadedAt else { return false }
        return Date().timeIntervalSince(loadedAt) < fourHours
    }

    private func topController(from controller: UIViewController?) -> UIViewController? {
        if let presented = controller?.presentedViewController { return topController(from: presented) }
        if let navigation = controller as? UINavigationController { return topController(from: navigation.visibleViewController) }
        if let tab = controller as? UITabBarController { return topController(from: tab.selectedViewController) }
        return controller
    }

    private func clearAndReload() {
        isShowing = false
        appOpenAd = nil
        loadedAt = nil
        loadAd()
    }

    func adDidDismissFullScreenContent(_ ad: FullScreenPresentingAd) {
        clearAndReload()
    }

    func ad(_ ad: FullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error) {
        clearAndReload()
    }
}

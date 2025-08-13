# <img src="https://d35aaqx5ub95lt.cloudfront.net/images/hearts/fa8debbce8d3e515c3b08cb10271fbee.svg" width="25px"> Extension Overview

> For **educational purposes** only, obviously.
>
> And I probably wont maintain this..
> 
> This took a day to figure out enjoy lol.



## Gist
> [!IMPORTANT]  
> The following domains are accessed for patching Duolingo's web app. Each serves a specific purpose:

| **Data Access**                          | **Why?**                                                               | **Duolingo Server?** |
|-----------------------------------------|-------------------------------------------------------------------------|----------------------|
| `duolingo.com`                          | Needed to modify the website and apply the patch.                         | ✅ Yes               |
| `d35aaqx5ub95lt.cloudfront.net`         | Hosts the original unpatched `app-*.js`; must tempoblock requests to this.    | ✅ Yes               |
| `raw.githubusercontent.com`             | Get's the version number of the extension for the icon popup to see if updates are available.          | ❌ No                |


## Installation Process

> [!NOTE]
> - **NOW AVAILABLE ON THE** [Mozilla Add-ons Store](https://addons.mozilla.org/en-US/firefox/addon/duolingo-unlimited-hearts/)
>   - Supports Firefox for Android
> - If we get some donations, I’ll be able to get a developer license and post it on the **Chrome Web Store**

| **Browser** | **Installation Steps** |
|-------------|------------------------|
| <img src="https://upload.wikimedia.org/wikipedia/commons/e/e1/Google_Chrome_icon_%28February_2022%29.svg" width="20px"> <img src="https://upload.wikimedia.org/wikipedia/commons/9/98/Microsoft_Edge_logo_%282019%29.svg" width="20px"> <img src="https://brave.com/static-assets/images/brave-logo-sans-text.svg" width="18px"> <img src="https://upload.wikimedia.org/wikipedia/commons/4/49/Opera_2015_icon.svg" width="20px"> | - Download the latest **Chrome (mv3)** extension from the [GitHub Releases](https://github.com/apersongithub/Duolingo-Unlimited-Hearts/releases)<br>- Go to `chrome://extensions`<br>- Enable **Developer mode** (top right)<br>- Drag and drop the ZIP file onto the extensions page<br>- ✅ You're all set! |
| <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Firefox_logo%2C_2019.svg/1200px-Firefox_logo%2C_2019.svg.png" width="20px"> <img src="https://c.clc2l.com/c/thumbnail96webp/t/t/o/tor-browser-QaPeUi.png" width="20px"> <img src="https://upload.wikimedia.org/wikipedia/commons/d/d0/LibreWolf_icon.svg" width="20px"> <img src="https://www.waterfox.net/_astro/waterfox.aA4DFn78.svg" width="20px"> | **Recommended:** Install directly from the [Mozilla Add-ons Store](https://addons.mozilla.org/en-US/firefox/addon/duolingo-unlimited-hearts/)<br>- ✅ You're all set! (automatic updates coming to the next release!)<br><br>**Manual Option:**<br>- Download the latest **Firefox** extension from the [GitHub Releases](https://github.com/apersongithub/Duolingo-Unlimited-Hearts/releases)<br>- Click **Continue Installation** when prompted<br>- ✅ You're all set! |

# <img src="https://d35aaqx5ub95lt.cloudfront.net/images/profile/48b8884ac9d7513e65f3a2b54984c5c4.svg" width="30px"> Frequently Asked Questions
### General FAQ

| **Question** | **Answer** |
|--------------|------------|
| Why do I see a white screen and nothing else? | You are likely using an older version (v1.0) of the extension. If not, create an issue. |
| Why isn't this working!??11!! 😡 | Reload your page. |
| Does this follow TOS? | [In my opinion, yes](https://www.duolingo.com/guidelines#:~:text=Script%20or%20cheat,may%20be%20removed.). This is all on the client so there is no effect on the system. |
| Is this safe? | Yes, this script changes only **two lines** of code which are only responsible for hearts. |
| Is this all free? | Yes, but feel free to [support me](https://www.buymeacoffee.com/aperson). |
| Why do I still have unlimited hearts after uninstalling the extension? | This will only happen on **Firefox** because the `app-*.js` is cached temporarily. If you want it gone you would need to: clear your site data for duolingo.com, close all duolingo tabs, and log back in to duolingo in a new tab. I wouldn't recommend deleting the extension to use the cached version because when duolingo updates (about every week) the cached version won't work.|
| How do I do this on my Apple (iPhone/iPad) or Android device? | - **Android**: You would first need to enable [Install unknown apps](https://www.wikihow.com/Allow-Apps-from-Unknown-Sources-on-Android) for the app you install the APK from. There are plenty of modded APKs available that unlock premium features. These can be found on various forums and third-party app stores. Do your research and be cautious about what you install.<br> Another option is using the **Firefox Browser**, which supports [imported extensions](https://blog.mozilla.org/addons/2020/09/29/expanded-extension-support-in-firefox-for-android-nightly/) similar to enabling developer mode on the desktop version of Chrome. This extension already has support for Firefox through the [Mozilla Add-ons Store](https://addons.mozilla.org/en-US/firefox/addon/duolingo-unlimited-hearts/) natively without debug mode. Other Android browsers that support extensions *may* also work.<br><br>- **Apple (iPhone/iPad)**: Modded IPAs do exist, but installing them requires **sideloading**, which means manually installing apps outside the App Store. This typically involves tools like [SideStore](https://sidestore.io/) **(Recommended)**, or a jailbroken device. If you plan on using SideStore I also recommend looking into [LiveContainer](https://github.com/LiveContainer/LiveContainer) because of apple's sideloaded app limits. Do your research and be cautious about what you install. <br><br>*Although these steps are somewhat tedious, the ability to download a wide range of modded apps more than makes up for the work—whether you're using an Android or Apple device. Think of the apps you use that have annoying ads or paywalled features...👀*|

> [!Note]
> - This extension for the Safari Browser or any webkit browser AKA **(EVERY BROWSER ON iPhone/iPad)** will never be supported unless Apple fully implements `webRequest` or `declarativeNetRequest` APIs, which are necessary for this extension to function.  
>   - Even if the above happened, not only would I need to buy a **Mac** to develop it on Apple’s proprietary Xcode platform, I would also need to pay **$99/year** for a developer license to publish the extension on the App Store.  
>   - I *could* use a virtual machine, but I’d still have to pay for the license...


### Developer FAQ

| **Question** | **Answer** |
|--------------|------------|
| Why is the modified `app-*.js` obfuscated? | The original `app-*.js` is obfuscated — there's nothing I can do. |
| How can I reproduce this? | Find your `app-*.js` download 'duolingo app.js patcher.html' and put it through. Then use firefox or chrome local overrides. |
| Why isn't the modified `app-*.js` in this repository? | It is all done locally. It only fetches the github for the version number. |
| Why is the code slightly differen't for each browser? | Firefox and Chrome do not have equal extension support. |

# <img src="https://d35aaqx5ub95lt.cloudfront.net/images/gems/45c14e05be9c1af1d7d0b54c6eed7eee.svg" width="20px"> Support Me

<a href="https://www.buymeacoffee.com/aperson" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

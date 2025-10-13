# <img src="https://d35aaqx5ub95lt.cloudfront.net/images/max/9f30dad6d7cc6723deeb2bd9e2f85dd8.svg" width="25px"> Duolingo Max
> For **educational purposes** only, obviously.
> 
> ***Previously known as Duolingo Unlimited Hearts***
> 
> *Not affilliated with Duolingo*



## Gist
> [!IMPORTANT]  
> 1. The following domains are accessed for patching Duolingo. Each domain serves a specific purpose:
>
> | **Data Access**                          | **Why?**                                                               | **Duolingo Server?** |
> |-----------------------------------------|-------------------------------------------------------------------------|----------------------|
> | `duolingo.com` `duolingo.cn`                          | Needed to modify the website and apply the patch.                         | ✅ Yes               |
> | `d35aaqx5ub95lt.cloudfront.net`         | Hosts the original unpatched webpack chunk files. Ex: `app-*.js`; must modify requests for these.    | ✅ Yes               |
> | `raw.githubusercontent.com`             | Get's the [extension-version.json](https://github.com/apersongithub/Duolingo-Unlimited-Hearts/blob/main/extension-version.json) which includes the version number, update log, and external html for my buymeacoffee banner.         | ❌ No                |
>
> 2. There are several different options to patch Duolingo. Choose what works best for your machine in the extensions' settings:
> <table>
>   <tr>
>     <td><img width="400" src="https://github.com/user-attachments/assets/38f62465-7402-4183-adb6-d157a7e5f443" alt="Map of Tectonic Plate Boundaries" /></td>
>   </tr>
> </table>
> 



## Installation Process

> [!NOTE]
> - **Available on** [Mozilla Add-ons Store](https://addons.mozilla.org/en-US/firefox/addon/duolingo-unlimited-hearts/), [Chrome Web Store](https://chromewebstore.google.com/detail/duolingo-max/jkcaeflmchplggcelmodjobeakgmhmdb)
>   - Supports Firefox for Android
>   - *Keep in mind that these extension stores may take upto a week to provide an extension update on your browser due to the reviewal process and your browsers' extension update cycle (By default it is within a week)*
> - ❗**NEW (Userscript Ports)**
>   - Supports iPhone/iPad on Safari if you install the [Userscripts](https://apps.apple.com/us/app/userscripts/id1463298887) app *(More info in the FAQ)*
>     - [Duolingo Max Userscript](https://github.com/apersongithub/Duolingo-Unlimited-Hearts/raw/refs/heads/main/userscript/Duolingo%20Max.user.js)
>     - [Duolingo Super Userscript](https://github.com/apersongithub/Duolingo-Unlimited-Hearts/raw/refs/heads/main/userscript/Duolingo%20Super.user.js)
>     - [Duolingo Unlimited Hearts Userscript](https://github.com/apersongithub/Duolingo-Unlimited-Hearts/raw/refs/heads/main/userscript/Duolingo%20Unlimited%20Hearts.user.js)
>     

| **Browser** | **Installation Steps** |
|-------------|------------------------|
| <img src="https://upload.wikimedia.org/wikipedia/commons/e/e1/Google_Chrome_icon_%28February_2022%29.svg" width="20px"> <img src="https://upload.wikimedia.org/wikipedia/commons/9/98/Microsoft_Edge_logo_%282019%29.svg" width="20px"> <img src="https://brave.com/static-assets/images/brave-logo-sans-text.svg" width="18px"> <img src="https://upload.wikimedia.org/wikipedia/commons/4/49/Opera_2015_icon.svg" width="20px"> | **Recommended:** Install directly from the [Chrome Web Store](https://chromewebstore.google.com/detail/duolingo-max/jkcaeflmchplggcelmodjobeakgmhmdb)<br> - Click **Add to Chrome** <br> - ✅ Done<br>- ⭐ Rate the addon<br><br>**Manual Option:**<br>- Download the latest **Chrome** extension from the [GitHub Releases](https://github.com/apersongithub/Duolingo-Unlimited-Hearts/releases)<br>- Go to `chrome://extensions`<br>- Enable **Developer mode** (top right)<br>- Drag and drop the ZIP file onto the extensions page<br>- ✅ Done |
| <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Firefox_logo%2C_2019.svg/1200px-Firefox_logo%2C_2019.svg.png" width="20px"> <img src="https://c.clc2l.com/c/thumbnail96webp/t/t/o/tor-browser-QaPeUi.png" width="20px"> <img src="https://upload.wikimedia.org/wikipedia/commons/d/d0/LibreWolf_icon.svg" width="20px"> <img src="https://www.waterfox.net/_astro/waterfox.aA4DFn78.svg" width="20px"> | **Recommended:** Install directly from the [Mozilla Add-ons Store](https://addons.mozilla.org/en-US/firefox/addon/duolingo-unlimited-hearts/)<br> - Click **Add to Firefox** <br> - ✅ Done<br>- ⭐ Rate the addon<br><br>**Manual Option:**<br>- Download the latest **Firefox** extension from the [GitHub Releases](https://github.com/apersongithub/Duolingo-Unlimited-Hearts/releases)<br>- Click **Continue Installation** when prompted<br>- ✅ Done |

# <img src="https://d35aaqx5ub95lt.cloudfront.net/images/profile/48b8884ac9d7513e65f3a2b54984c5c4.svg" width="30px"> Frequently Asked Questions
### General FAQ

| **Question** | **Answer** |
|--------------|------------|
| Why do I see a white screen and nothing else? | You are likely using an older version of the extension. If not, create an issue. |
| Why should I use this extension over the userscript(s)? | The extension provides a constant stream of updates with more hardcoded changes to the site to prevent the bypasses from being patched. It also just comes with more QOL features. |
| Does this follow TOS? | [In my opinion, yes](https://www.duolingo.com/guidelines#:~:text=Script%20or%20cheat,may%20be%20removed.). This is all on the client so there is no effect on the system. |
| Is this safe? | Yes, this extension is open source and only changes a few lines of code which are solely responsible for the paid features. |
| Is this all free? | Yes, but feel free to [support me](https://html-preview.github.io/?url=https://raw.githubusercontent.com/apersongithub/Duolingo-Unlimited-Hearts/refs/heads/main/extras/donations.html). |
| Can I get banned for using this? | You won't get banned period. Duolingo only bans if you actually abuse the system which brings me to my next question below. |
| Can you get me unlimited gems, streaks or XP? | It is possible with the Duolingo-PRO userscript (***❗DUOLINGO-PRO IS NOT MY USERSCRIPT***). I personally **do not recommend it** as it sends your account information to a server that isn't Duolingo's and you don't know what they do with your data. Duolingo-PRO also breaks TOS and could get your account permanantly banned. Also why would you want to do this anyways...you shouldn't be obsessed with some internet points as it doesn't help you actually learn a language. To be safe stick to my [Duolingo Unlimited Hearts Userscript](https://github.com/apersongithub/Duolingo-Unlimited-Hearts/raw/refs/heads/main/userscript/Duolingo%20Unlimited%20Hearts.user.js) or my extension as everything is localized meaning it doesn't send data to servers.|
| Can you make a userscript like Duolingo-PRO that is safe or localized? | No, my goal here isn't to create cheats, it is just to make learning more accessible and easier on Duolingo like how it used to be a couple years ago.  |
| Why do I still have Duolingo Max after uninstalling the extension? | This will only happen on **Firefox** because the patched files are cached temporarily. If you want it gone you would need to: clear your site data for duolingo.com, close all duolingo tabs, and log back in to duolingo in a new tab. You can also just wait until the site updates which brings me to my next point——I wouldn't recommend deleting the extension to use the cached version because when duolingo updates (about every week) the cached version won't work and it will be reverted to normal.|
| How do I know if the extension needs to update? | You can either click on the extension icon or just wait until it notifies you. It will show a popup with the version number. It will tell you if the extension requires updates or not based on a fetched version number from this respository. |
| How do I install the Unlimited Hearts/Max Features userscript? | Install the [Tampermonkey](https://www.tampermonkey.net/) extension and download the [raw file](https://github.com/apersongithub/Duolingo-Unlimited-Hearts/tree/main/userscript). Greasemonkey and other similar extensions may also work. |
| Why am I missing the `Video Calls`, `Roleplay`, and `Explain My Answer` feature(s)? | Duolingo hasn't implemented these mobile features into the website so I cannot add them. I don't think I'll be able to add these features anyways as it's likely fully server sided but I will try to if it gets implemented. In my opinion, I don't think these AI features are nesscessary and you shouldn't be relying solely on Duolingo for language learning. Talk with real people not AI! |
| Does this work if I have [energy](https://duolingo.fandom.com/wiki/Energy) and not hearts? | Energy is a mobile app only feature, go to the last question for more info. |
| How do I do this on my Apple (iPhone/iPad) or Android device? | - **Android**: You would first need to enable [Install unknown apps](https://www.wikihow.com/Allow-Apps-from-Unknown-Sources-on-Android) for the app you install the APK from. There are plenty of modded APKs available that unlock premium features. These can be found on various forums and third-party app stores. Do your research and be cautious about what you install.<br> Another option is using the **Firefox Browser**, which supports [imported extensions](https://blog.mozilla.org/addons/2020/09/29/expanded-extension-support-in-firefox-for-android-nightly/) similar to enabling developer mode on the desktop version of Chrome. This extension already has support for Firefox through the [Mozilla Add-ons Store](https://addons.mozilla.org/en-US/firefox/addon/duolingo-unlimited-hearts/) natively without debug mode. Other Android browsers that support extensions *may* also work.<br><br>- **Apple (iPhone/iPad)**: Modded IPAs do exist, but installing them requires **sideloading**, which means manually installing apps outside the App Store. This typically involves tools like [SideStore](https://sidestore.io/) **(Recommended)**, or a jailbroken device. If you plan on using SideStore I also recommend looking into [LiveContainer](https://github.com/LiveContainer/LiveContainer) because of apple's sideloaded app limits. Do your research and be cautious about what you install. <br>Another option is using the **[Userscripts App](https://apps.apple.com/us/app/userscripts/id1463298887)**, which is basically Tampermonkey for iOS. You can use this by importing [Unlimited Hearts Userscript](https://github.com/apersongithub/Duolingo-Unlimited-Hearts/raw/refs/heads/main/userscript/Duolingo%20Unlimited%20Hearts.user.js) or [Max Features Userscript](https://github.com/apersongithub/Duolingo-Unlimited-Hearts/raw/refs/heads/main/userscript/Duolingo%20Max.user.js). After that, open duolingo (web) on Safari and you'll have unlimited hearts or max features *(You may have to refresh the page).* <br><br>*Although the steps for modded apps are somewhat tedious, the ability to download a wide range of modded apps more than makes up for the work—whether you're using an Android or Apple device. Think of the apps you use that have annoying ads or paywalled features...👀*|

> [!Note]
> - This extension for the Safari Browser or any webkit browser AKA **(EVERY BROWSER ON iPhone/iPad)** will never be supported unless Apple fully implements `webRequest` or `declarativeNetRequest` APIs, which are necessary for this extension to function.  
>   - Even if the above happened, not only would I need to buy a **Mac** to develop it on Apple’s proprietary Xcode platform, I would also need to pay **$99/year** for a developer license to publish the extension on the App Store.  
>   - I *could* use a virtual machine, but I’d still have to pay for the license...
>   - TLDR: Use the userscript(s) if you are on iOS.


### Developer FAQ

| **Question** | **Answer** |
|--------------|------------|
| Why is the modified patched files minified/bundled? | The unpatched files are also minified because they are [webpack chunks](https://webpack.js.org/) — there's nothing I can do. |
| Are there any third-party server components in the userscript or extension. | No and there **never** will be as my goal is to make everything local. I don't want your data lol.
| How can I reproduce this? | Find your required webpack chunks/files then open '[duolingo patcher.html](https://html-preview.github.io/?url=https://raw.githubusercontent.com/apersongithub/Duolingo-Unlimited-Hearts/refs/heads/main/extras/duolingo%20patcher.html)' and put it through. Then download the newly patched files and use firefox or chrome local overrides to point it towards the patched files you just downloaded (Currently only for the Default Patch).  |
| Why aren't the modified patched files in this repository? | It is all done locally. It only fetches the github for the [extension-version.json](https://github.com/apersongithub/Duolingo-Unlimited-Hearts/blob/main/extension-version.json). |
| Why is the code slightly differen't for each browser? | Firefox and Chrome do not have equal extension support. I try my best to keep code parity between both browsers. |
| What happened to the chrome mv2 version of this extension? | I decided to remove it as major browsers don't support it anymore. |
| Will this always be open source? | Yes, this will **never** be closed source. |
| How does the userscript work? | It's very simple, the script intercepts your duolingo "account" json data file. It then finds and sets specfic objects related to premium features and sets them to true. |
| Is my Duolingo Account Token/Cookie being accessed? | With the **extension** nope, your account data is not accessed. Though with the **userscripts**, only your json data file is accessed which is all done locally anyways. |
| How do I know you won't add malicious code to the [extension-version.json](https://github.com/apersongithub/Duolingo-Unlimited-Hearts/blob/main/extension-version.json)?  | In versions `v3.2` and newer, [all remote JavaScript/XSS is automatically removed](https://github.com/search?q=repo%3Aapersongithub/Duolingo-Unlimited-Hearts%20sanitizeHTML&type=code). Version `v2.0` is also safe because an external banner wasn't implemented yet. This JS/XSS sanitization was added to ensure end users don't have to simply trust that I won't add anything malicious; they can be confident the extension is secure. |

# <img src="https://d35aaqx5ub95lt.cloudfront.net/images/gems/45c14e05be9c1af1d7d0b54c6eed7eee.svg" width="20px"> Support Me

| ⭐ PayPal (Preferred) | Buy Me a Coffee |
|--------|----------------|
| <a href="https://www.paypal.com/paypalme/luv4rent" target="_blank"><img src="https://raw.githubusercontent.com/apersongithub/Duolingo-Unlimited-Hearts/refs/heads/main/extras/paypal.png" alt="Paypal Me" style="height: 160px !important;width: 217px !important;"></a> | <a href="https://www.buymeacoffee.com/aperson" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;"></a> |

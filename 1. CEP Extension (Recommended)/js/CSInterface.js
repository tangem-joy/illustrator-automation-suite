/**
 * CSInterface.js - Adobe CEP Communication Library
 * Unified Automation Suite Pro
 */

'use strict';

var CSInterface = (function () {
    function CSInterface() {
        this.hostEnvironment = window.__adobe_cep__ ? JSON.parse(window.__adobe_cep__.getHostEnvironment()) : null;
        this.EVENT_TYPE_SYSTEM = 'com.adobe.csxs.events.system';
        this.THEME_COLOR_CHANGED_EVENT = 'com.adobe.csxs.events.ThemeColorChanged';
    }

    CSInterface.prototype.getSystemPath = function (pathType) {
        var path = window.__adobe_cep__ ? window.__adobe_cep__.getSystemPath(pathType) : '';
        return path;
    };

    CSInterface.prototype.evalScript = function (script, callback) {
        if (!window.__adobe_cep__) {
            if (callback) callback(JSON.stringify({ success: true, simulated: true, message: "Simulation mode" }));
            return;
        }
        if (callback === null || callback === undefined) {
            window.__adobe_cep__.evalScript(script);
        } else {
            window.__adobe_cep__.evalScript(script, function (result) {
                callback(result);
            });
        }
    };

    CSInterface.prototype.openURLInDefaultBrowser = function (url) {
        if (window.__adobe_cep__) {
            window.__adobe_cep__.openURLInDefaultBrowser(url);
        }
    };

    CSInterface.prototype.showExtensionBuiltInDialog = function () {
        if (window.__adobe_cep__) {
            return window.__adobe_cep__.showExtensionBuiltInDialog();
        }
        return null;
    };

    CSInterface.prototype.closeExtension = function () {
        if (window.__adobe_cep__) {
            window.__adobe_cep__.closeExtension();
        }
    };

    // Path types
    CSInterface.SYSTEM_PATH_APP = 'appPath';
    CSInterface.SYSTEM_PATH_EXTENSION = 'extensionPath';
    CSInterface.SYSTEM_PATH_USER_DATA = 'userData';
    CSInterface.SYSTEM_PATH_COMMON_FILES = 'commonFiles';
    CSInterface.SYSTEM_PATH_MY_DOCUMENTS = 'myDocuments';
    CSInterface.SYSTEM_PATH_APPLICATION = 'application';
    CSInterface.SYSTEM_PATH_HOST_APP = 'hostApplication';

    return CSInterface;
})();

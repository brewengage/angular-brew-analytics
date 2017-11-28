/**
 * angular-brew-analytics - Angular BrewEngage Analytics - Easy tracking for your AngularJS application
 * @version v2.0.0
 * @link http://github.com/brewengage/angular-brew-analytics
 * @author Ravi Kannan <ravi@brewengage.com> (https://github.com/brewengage)
 * @contributors Julien Bouquillon (https://github.com/revolunet)
 * @contributors BrewEngage (added support for ui-router)
 * @license MIT
 */


/* globals define */
(function (root, factory) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports) {
    if (typeof angular === 'undefined') {
      factory(require('angular'));
    } else {
      factory(angular);
    }
    module.exports = 'angular-brew-analytics';
  } else if (typeof define === 'function' && define.amd) {
    define(['angular'], factory);
  } else {
    factory(root.angular);
  }
}(this, function (angular, undefined) {
  'use strict';
  angular.module('angular-brew-analytics', [])
    .provider('Analytics', function () {

      // define constant
      var CONST_ROUTER_TYPE = {
        UI_ROUTER: 'ui',
        NG_ROUTER: 'ng'
      };
            
      var accounts,
          analyticsJS = false,
          cookieConfig = 'auto', // DEPRECATED
          created = false,
          crossDomainLinker = false,
          crossLinkDomains,
          currency = 'USD',
          debugMode = false,
          delayScriptTag = false,
          displayFeatures = false,
          disableAnalytics = false,
          domainName,
          ecommerce = false,
          enhancedEcommerce = false,
          enhancedLinkAttribution = false,
          experimentId,
          ignoreFirstPageLoad = false,
          logAllCalls = false,
          hybridMobileSupport = false,
          offlineMode = false,
          pageEvent = '$routeChangeSuccess',
          readFromRoute = false,
          removeRegExp,
          testMode = false,
          traceDebuggingMode = false,
          trackPrefix = '',
          trackRoutes = true,
          trackUrlParams = false,
          routerType = CONST_ROUTER_TYPE.NG_ROUTER,
          userId = '', // unique Id which identifies a user 
          enableLinkTracking = true,
          enableHeartBeatTimer =  30; // default
  


      this.log = [];
      this.offlineQueue = [];

      /**
       * Configuration Methods
       **/

      this.setAccount = function (tracker) {
        if (angular.isUndefined(tracker) || tracker === false) {
          accounts = undefined;
        } else if (angular.isArray(tracker)) {
          accounts = tracker;
        } else if (angular.isObject(tracker)) {
          accounts = [tracker];
        } else {
          // In order to preserve an existing behavior with how the _trackEvent function works,
          // the trackEvent property must be set to true when there is only a single tracker.
          accounts = [{ tracker: tracker, trackEvent: true }];
        }
        return this;
      };

      this.trackPages = function (val) {
        trackRoutes = !!val;
        return this;
      };

      this.trackPrefix = function (prefix) {
        trackPrefix = prefix;
        return this;
      };

      this.setDomainName = function (domain) {
        domainName = domain;
        return this;
      };

      this.useDisplayFeatures = function (val) {
        displayFeatures = !!val;
        return this;
      };

      // this.useAnalytics = function (val) {
      //   analyticsJS = !!val;
      //   return this;
      // };

      this.useEnhancedLinkAttribution = function (val) {
        enhancedLinkAttribution = !!val;
        return this;
      };

      this.useCrossDomainLinker = function (val) {
        crossDomainLinker = !!val;
        return this;
      };

      this.setCrossLinkDomains = function (domains) {
        crossLinkDomains = domains;
        return this;
      };

      this.setPageEvent = function (name) {
        pageEvent = name;
        return this;
      };

      this.useECommerce = function (val, enhanced) {
        ecommerce = !!val;
        enhancedEcommerce = !!enhanced;
        return this;
      };

      this.setCurrency = function (currencyCode) {
        currency = currencyCode;
        return this;
      };

      this.setRemoveRegExp = function (regex) {
        if (regex instanceof RegExp) {
          removeRegExp = regex;
        }
        return this;
      };

      this.setExperimentId = function (id) {
        experimentId = id;
        return this;
      };

      this.ignoreFirstPageLoad = function (val) {
        ignoreFirstPageLoad = !!val;
        return this;
      };

      this.trackUrlParams = function (val) {
        trackUrlParams = !!val;
        return this;
      };

      this.disableAnalytics = function (val) {
        disableAnalytics = !!val;
        return this;
      };

      this.setHybridMobileSupport = function (val) {
        hybridMobileSupport = !!val;
        return this;
      };

      this.startOffline = function (val) {
        offlineMode = !!val;
        if (offlineMode === true) {
          this.delayScriptTag(true);
        }
        return this;
      };

      this.delayScriptTag = function (val) {
        delayScriptTag = !!val;
        return this;
      };

      this.logAllCalls = function (val) {
        logAllCalls = !!val;
        return this;
      };

      this.enterTestMode = function () {
        testMode = true;
        return this;
      };

      this.enterDebugMode = function (enableTraceDebugging) {
        debugMode = true;
        traceDebuggingMode = !!enableTraceDebugging;
        return this;
      };
      
      // Enable reading page url from route object
      this.readFromRoute = function(val) {
        readFromRoute = !!val;
        return this;
      };

      this.enableLinkTracking = function(enable) {
        enableLinkTracking = !!enable;
        return this;
      };
      
      this.enableHeartBeatTimer = function(delayInSeconds) {
        enableHeartBeatTimer =  delayInSeconds ? delayInSeconds : 15;
        return this;
      };

      this.setUserId = function(id) {
        userId = id;
        return this;
      };

      /*
       * Public Service
       */
      this.$get = ['$document', // To read page title 
                   '$location', //
                   '$log',      //
                   '$rootScope',//
                   '$window',   //
                   '$injector', // To access ng/ui Route module without declaring a fixed dependency
                   function ($document, $location, $log, $rootScope, $window, $injector) {
        var that = this;

        /**
         * Side-effect Free Helper Methods
         **/

        var isPropertyDefined = function (key, config) {
          return angular.isObject(config) && angular.isDefined(config[key]);
        };

        var isPropertySetTo = function (key, config, value) {
          return isPropertyDefined(key, config) && config[key] === value;
        };

        var generateCommandName = function (commandName, config) {
          if (angular.isString(config)) {
            return config + '.' + commandName;
          }
          return isPropertyDefined('name', config) ? (config.name + '.' + commandName) : commandName;
        };

        // Private method.
        var _getRouterType = function($injector) {
          var type = ($injector.has('$urlRouter') ? CONST_ROUTER_TYPE.UI_ROUTER : CONST_ROUTER_TYPE.NG_ROUTER); 
          return type;
        };
        
        function _isObjectEmpty(obj) { 
          for (var x in obj) 
            return false;
          return true;
        }

        // Try to read route configuration and log warning if not possible
        var $route = {};
        if (readFromRoute) {
          // check type of router used by angular app
          routerType = _getRouterType($injector);
          switch(routerType)
          {
            case CONST_ROUTER_TYPE.UI_ROUTER: $route = $injector.get('$urlRouter'); break;
            case CONST_ROUTER_TYPE.NG_ROUTER: $route = $injector.get('$route'); break;
          }
          
          if (_isObjectEmpty($route)) {
            $log.warn('No route service is available. Make sure you have included ngRoute or ui.router in your application dependencies.');
          }
        }

        // Get url for current page 
        var getUrl = function () {
          // Using route provided tracking urls
          if (readFromRoute && $route.current && ('baPageTrack' in $route.current)) {
            return $route.current.baPageTrack;
          }
           
          // Otherwise go the old way
          var url = trackUrlParams ? $location.url() : $location.path(); 
          return removeRegExp ? url.replace(removeRegExp, '') : url;
        };

        // Get title of current page
        var getTitle = function () {
          // Using route provided document title
          if (readFromRoute && $route.current && ('baPageTitle' in $route.current)) {
            return $route.current.baPageTitle;
          }

          // Otherwise go the old way
          return $document[0].title;
        };

        var getUtmParams = function () {
          var utmToCampaignVar = {
            pk_source: 'campaignSource',
            pk_medium: 'campaignMedium',
            pk_term: 'campaignTerm',
            pk_content: 'campaignContent',
            pk_campaign: 'campaignName'
          };
          var object = {};

          angular.forEach($location.search(), function (value, key) {
            var campaignVar = utmToCampaignVar[key];

            if (angular.isDefined(campaignVar)) {
              object[campaignVar] = value;
            }
          });

          return object;
        };

        /**
         * get ActionFieldObject
         * https://developers.google.com/analytics/devguides/collection/analyticsjs/enhanced-ecommerce#action-data
         * @param id
         * @param affliation
         * @param revenue
         * @param tax
         * @param shipping
         * @param coupon
         * @param list
         * @param step
         * @param option
         */
        var getActionFieldObject = function (id, affiliation, revenue, tax, shipping, coupon, list, step, option) {
          var obj = {};
          if (id) { obj.id = id; }
          if (affiliation) { obj.affiliation = affiliation; }
          if (revenue) { obj.revenue = revenue; }
          if (tax) { obj.tax = tax; }
          if (shipping) { obj.shipping = shipping; }
          if (coupon) { obj.coupon = coupon; }
          if (list) { obj.list = list; }
          if (step) { obj.step = step; }
          if (option) { obj.option = option; }
          return obj;
        };

        /**
         * Private Methods
         */

        var _getProtocol = function (httpPostfix, httpsPostfix) {
          var protocol = '',
              isSslEnabled = document.location.protocol === 'https:',
              isChromeExtension = document.location.protocol === 'chrome-extension:',
              isHybridApplication = analyticsJS === true && hybridMobileSupport === true;
          httpPostfix = angular.isString(httpPostfix) ? httpPostfix : '';
          httpsPostfix = angular.isString(httpsPostfix) ? httpsPostfix : '';
          if (httpPostfix !== '') {
            protocol = 'http:' + httpPostfix;
          }
          if (isChromeExtension || isHybridApplication || (isSslEnabled && httpsPostfix !== '')) {
            protocol = 'https:' + httpsPostfix;
          }
          return protocol;
        };

        var _baJs = function (fn) {
          if (!analyticsJS && $window._brew && typeof fn === 'function') {
            fn();
          }
        };

        var _brewTrack = function () {
          var args = Array.prototype.slice.call(arguments);
          if (offlineMode === true) {
            that.offlineQueue.push([_brewTrack, args]);
            return;
          }
          if (!$window._brew) { // global _brew array
            $window._brew = [];
          }
          if (logAllCalls === true) {
            that._log.apply(that, args);
          }
          $window._brew.push(args);
        };

        // var _analyticsJs = function (fn) {
        //   if (analyticsJS && $window.ba && typeof fn === 'function') {
        //     fn();
        //   }
        // };

        // var _ga = function () {
        //   var args = Array.prototype.slice.call(arguments);
        //   if (offlineMode === true) {
        //     that.offlineQueue.push([_ga, args]);
        //     return;
        //   }
        //   if (typeof $window.ga !== 'function') {
        //     that._log('warn', 'ga function not set on window');
        //     return;
        //   }
        //   if (logAllCalls === true) {
        //     that._log.apply(that, args);
        //   }
        //   $window.ga.apply(null, args);
        // };

        // var _gaMultipleTrackers = function (includeFn) {
        //   // Drop the includeFn from the arguments and preserve the original command name
        //   var args = Array.prototype.slice.call(arguments, 1),
        //       commandName = args[0],
        //       trackers = [];
        //   if (typeof includeFn === 'function') {
        //     accounts.forEach(function (account) {
        //       if (includeFn(account)) {
        //         trackers.push(account);
        //       }
        //     });
        //   } else {
        //     // No include function indicates that all accounts are to be used
        //     trackers = accounts;
        //   }

        //   // To preserve backwards compatibility fallback to _ga method if no account
        //   // matches the specified includeFn. This preserves existing behaviors by
        //   // performing the single tracker operation.
        //   if (trackers.length === 0) {
        //     _ga.apply(that, args);
        //     return;
        //   }

        //   trackers.forEach(function (tracker) {
        //     // Check tracker 'select' function, if it exists, for whether the tracker should be used with the current command.
        //     // If the 'select' function returns false then the tracker will not be used with the current command.
        //     if (isPropertyDefined('select', tracker) && typeof tracker.select === 'function' && !tracker.select(args)) {
        //       return;
        //     }
        //     args[0] = generateCommandName(commandName, tracker);
        //     _ga.apply(that, args);
        //   });
        // };

        this._log = function () {
          var args = Array.prototype.slice.call(arguments);
          if (args.length > 0) {
            if (args.length > 1) {
              switch (args[0]) {
                case 'debug':
                case 'error':
                case 'info':
                case 'log':
                case 'warn':
                  $log[args[0]](args.slice(1));
                  break;
              }
            }
            that.log.push(args);
          }
        };

        /* DEPRECATED */
        // this._createScriptTag = function () {
        //   that._registerScriptTags();
        //   that._registerTrackers();
        // };

        // /* DEPRECATED */
        // this._createAnalyticsScriptTag = function () {
        //   that._registerScriptTags();
        //   that._registerTrackers();
        // };

        this._registerScriptTags = function () {
          var document = $document[0],
              protocol = _getProtocol(),
              scriptSource;

          if (created === true) {
            that._log('warn', 'Script tags already created');
            return;
          }

          if (disableAnalytics === true) {
            accounts.forEach(function (trackerObj) {
              that._log('info', 'Brew Analytics disabled: ' + trackerObj.tracker);
              $window['ba-disable-' + trackerObj.tracker] = true;
            });
          }

          //
          // Universal Analytics
          //
          if (analyticsJS === true) {
            // scriptSource = protocol + '//www.google-analytics.com/' + (debugMode ? 'analytics_debug.js' : 'analytics.js');
            // if (testMode !== true) {
            //   // If not in test mode inject the Google Analytics tag
            //   (function (i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function (){
            //     (i[r].q=i[r].q||[]).push(arguments);},i[r].l=1*new Date();a=s.createElement(o),
            //     m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m);
            //   })(window,document,'script',scriptSource,'ga');
            // } else {
            //   if (typeof $window.ga !== 'function') {
            //     // In test mode create a ga function if none exists that is a noop sink.
            //     $window.ga = function () {};
            //   }
            //   // Log script injection.
            //   that._log('inject', scriptSource);
            // }

            // if (traceDebuggingMode) {
            //   $window.ga_debug = { trace: true };
            // }

            // if (experimentId) {
            //   var expScript = document.createElement('script'),
            //       s = document.getElementsByTagName('script')[0];
            //   expScript.src = protocol + '//www.google-analytics.com/cx/api.js?experiment=' + experimentId;
            //   s.parentNode.insertBefore(expScript, s);
            // }
            
          //
          // Classic Analytics
          //
          } else {
            //scriptSource = _getProtocol('//www', '//ssl') + '.google-analytics.com/ga.js';
  

            // if (displayFeatures === true) {
            //   scriptSource = protocol + '//stats.g.doubleclick.net/dc.js';
            // }

            if (testMode != true) {
              // If not in test mode inject the BrewEngage Analytics tag
              (function(b, r, e, w, i, n, g, h) {
                b['BrewAnalyticsObject'] = n;
                b['brewNewStyle'] = true;
                
                _brewTrack('setTrackerUrl', w+i+'.php');

                //b[n] = b[n] || function(){(b[n].q = b[n].q || []).push(arguments)};
                g = r.createElement(e);
                h = r.getElementsByTagName(e)[0];
                g.src = w + i + '.js?v=a6';
                h.parentNode.insertBefore(g, h);

                // '//localhost:8888/brewanalytics/'
              })(window, document, 'script', domainName, 'brewanalytics', 'brew');
            } else {
              // Log the source location for validation
              that._log('inject', scriptSource);
            }
          }

          created = true;
          return true;
        };

        this._registerTrackers = function () {
          if (!accounts || accounts.length < 1) {
            that._log('warn', 'No accounts to register');
            return;
          }

          //
          // Classic Analytics
          //
          if (accounts.length > 1) {
            that._log('warn', 'Multiple trackers are not supported with brewanalytics.js. Using first tracker only');
            accounts = accounts.slice(0, 1);
          }

          // set traceker URL
          // TODO: change location of tracker url

          that._enableLinkTracking(enableLinkTracking);
          that._enableHeartBeatTimer(enableHeartBeatTimer);

          // set the site to be tracked
          _brewTrack('setSiteId', accounts[0].tracker);
          
          // if(domainName) {
          //   _brewTrack('_setDomainName', domainName);
          // }
          // if (enhancedLinkAttribution) {
          //   _brewTrack('_require', 'inpage_linkid', '//www.google-analytics.com/plugins/ga/inpage_linkid.js');
          // }
          if (trackRoutes && !ignoreFirstPageLoad) {
            if (removeRegExp) {
              that._trackPage(getUrl());
            } else {
              that._trackPage();
            }
          }
          return true;
        };

        this._ecommerceEnabled = function (warn, command) {
          var result = ecommerce && !enhancedEcommerce;
          if (warn === true && result === false) {
            if (ecommerce && enhancedEcommerce) {
              that._log('warn', command + ' is not available when Enhanced Ecommerce is enabled with brewanalytics.js');
            } else {
              that._log('warn', 'Ecommerce must be enabled to use ' + command + ' with brewanalytics.js');
            }
          }
          return result;
        };

        this._enhancedEcommerceEnabled = function (warn, command) {
          var result = ecommerce && enhancedEcommerce;
          if (warn === true && result === false) {
            that._log('warn', 'Enhanced Ecommerce must be enabled to use ' + command + ' with brewanalytics.js');
          }
          return result;
        };

        /**
         * Enable link tracking
         * @param enable - default is false         
         * @private
         */
        this._enableLinkTracking = function(enable) {
          enable = enable ? enable : false;
          _baJs(function() {
            _brewTrack('enableLinkTracking', enable);
          });
        };

        /**
         * Enable heart beat timer
         * @param delayInSeconds - default is 15 seconds
         * @private
         */
        this._enableHeartBeatTimer = function (delayInSeconds) {
          delayInSeconds = delayInSeconds ? delayInSeconds : 30;
          _baJs(function() {
            _brewTrack('enableHeartBeatTimer', delayInSeconds);
          });
        };

        /**
         * Track page
         https://developers.google.com/analytics/devguides/collection/gajs/
         https://developers.google.com/analytics/devguides/collection/analyticsjs/pages
         * @param url
         * @param title
         * @param custom
         * @private
         */
        this._trackPage = function (url, title, custom) {
          url = url ? url : getUrl();
          title = title ? title : getTitle();
          _baJs(function () {
            // http://stackoverflow.com/questions/7322288/how-can-i-set-a-page-title-with-google-analytics
            _brewTrack('setDocumentTitle', title);
            _brewTrack('setCustomUrl', (trackPrefix + url));
            _brewTrack('trackPageView');
          });
          // _analyticsJs(function () {
          //   var opt_fieldObject = {
          //     'page': trackPrefix + url,
          //     'title': title
          //   };
          //   angular.extend(opt_fieldObject, getUtmParams());
          //   if (angular.isObject(custom)) {
          //     angular.extend(opt_fieldObject, custom);
          //   }
          //   _gaMultipleTrackers(undefined, 'send', 'pageview', opt_fieldObject);
          // });
        };

        /**
         * Track event
         https://developers.google.com/analytics/devguides/collection/gajs/eventTrackerGuide
         https://developers.google.com/analytics/devguides/collection/analyticsjs/events
         * @param category
         * @param action
         * @param label
         * @param value
         * @param noninteraction
         * @param custom
         * @private
         */
        this._trackEvent = function (category, action, name, value) {
          _baJs(function () {
            _brewTrack('trackEvent', category, action, name, value);
          });
          // _analyticsJs(function () {
          //   var opt_fieldObject = {};
          //   var includeFn = function (trackerObj) {
          //     return isPropertySetTo('trackEvent', trackerObj, true);
          //   };

          //   if (angular.isDefined(noninteraction)) {
          //     opt_fieldObject.nonInteraction = !!noninteraction;
          //   }
          //   if (angular.isObject(custom)) {
          //     angular.extend(opt_fieldObject, custom);
          //   }
          //   if (!angular.isDefined(opt_fieldObject.page)) {
          //     opt_fieldObject.page = getUrl();
          //   }
          //   _gaMultipleTrackers(includeFn, 'send', 'event', category, action, label, value, opt_fieldObject);
          // });
        };

        /**
         * Add transaction
         * https://developers.google.com/analytics/devguides/collection/gajs/methods/gaJSApiEcommerce#_gat.GA_Tracker_._addTrans
         * https://developers.google.com/analytics/devguides/collection/analyticsjs/ecommerce#addTrans
         * @param transactionId
         * @param affiliation
         * @param total
         * @param tax
         * @param shipping
         * @param city
         * @param state
         * @param country
         * @private
         */
        this._addTrans = function (transactionId, affiliation, total, tax, shipping, city, state, country, currency) {
          _baJs(function () {
            _brewTrack('_addTrans', transactionId, affiliation, total, tax, shipping, city, state, country);
          });
          // _analyticsJs(function () {
          //   if (that._ecommerceEnabled(true, 'addTrans')) {
          //     var includeFn = function (trackerObj) {
          //       return isPropertySetTo('trackEcommerce', trackerObj, true);
          //     };

          //     _gaMultipleTrackers(
          //       includeFn,
          //       'ecommerce:addTransaction',
          //       {
          //         id: transactionId,
          //         affiliation: affiliation,
          //         revenue: total,
          //         tax: tax,
          //         shipping: shipping,
          //         currency: currency || 'USD'
          //       });
          //   }
          // });
        };

        /**
         * Add item to transaction
         * https://developers.google.com/analytics/devguides/collection/gajs/methods/gaJSApiEcommerce#_gat.GA_Tracker_._addItem
         * https://developers.google.com/analytics/devguides/collection/analyticsjs/ecommerce#addItem
         * @param transactionId
         * @param sku
         * @param name
         * @param category
         * @param price
         * @param quantity
         * @private
         */
        this._addItem = function (transactionId, sku, name, category, price, quantity) {
          _baJs(function () {
            _brewTrack('_addItem', transactionId, sku, name, category, price, quantity);
          });
          // _analyticsJs(function () {
          //   if (that._ecommerceEnabled(true, 'addItem')) {
          //     var includeFn = function (trackerObj) {
          //       return isPropertySetTo('trackEcommerce', trackerObj, true);
          //     };

          //     _gaMultipleTrackers(
          //       includeFn,
          //       'ecommerce:addItem',
          //       {
          //         id: transactionId,
          //         name: name,
          //         sku: sku,
          //         category: category,
          //         price: price,
          //         quantity: quantity
          //       });
          //   }
          // });
        };

        /**
         * Track transaction
         * https://developers.google.com/analytics/devguides/collection/gajs/methods/gaJSApiEcommerce#_gat.GA_Tracker_._trackTrans
         * https://developers.google.com/analytics/devguides/collection/analyticsjs/ecommerce#sendingData
         * @private
         */
        this._trackTrans = function () {
          _baJs(function () {
            _brewTrack('_trackTrans');
          });
          // _analyticsJs(function () {
          //   if (that._ecommerceEnabled(true, 'trackTrans')) {
          //     var includeFn = function (trackerObj) {
          //       return isPropertySetTo('trackEcommerce', trackerObj, true);
          //     };

          //     _gaMultipleTrackers(includeFn, 'ecommerce:send');
          //   }
          // });
        };

        /**
         * Clear transaction
         * https://developers.google.com/analytics/devguides/collection/analyticsjs/ecommerce#clearingData
         * @private
         */
        this._clearTrans = function () {
          // _analyticsJs(function () {
          //   if (that._ecommerceEnabled(true, 'clearTrans')) {
          //     var includeFn = function (trackerObj) {
          //       return isPropertySetTo('trackEcommerce', trackerObj, true);
          //     };

          //     _gaMultipleTrackers(includeFn, 'ecommerce:clear');
          //   }
          // });
        };

        /**
         * Enhanced Ecommerce
         */

        /**
         * Add Product
         * https://developers.google.com/analytics/devguides/collection/analyticsjs/enhanced-ecommerce#product-data
         * @param productId
         * @param name
         * @param category
         * @param brand
         * @param variant
         * @param price
         * @param quantity
         * @param coupon
         * @param position
         * @param custom
         * @private
         */
        this._addProduct = function (productId, name, category, brand, variant, price, quantity, coupon, position, custom) {
          _baJs(function () {
            _brewTrack('_addProduct', productId, name, category, brand, variant, price, quantity, coupon, position);
          });
          // _analyticsJs(function () {
          //   if (that._enhancedEcommerceEnabled(true, 'addProduct')) {
          //     var includeFn = function (trackerObj) {
          //       return isPropertySetTo('trackEcommerce', trackerObj, true);
          //     };
          //     var details = {
          //       id: productId,
          //       name: name,
          //       category: category,
          //       brand: brand,
          //       variant: variant,
          //       price: price,
          //       quantity: quantity,
          //       coupon: coupon,
          //       position: position
          //     };
          //     if (angular.isObject(custom)) {
          //       angular.extend(details, custom);
          //     }
          //     _gaMultipleTrackers(includeFn, 'ec:addProduct', details);
          //   }
          // });
        };

        /**
         * Add Impression
         * https://developers.google.com/analytics/devguides/collection/analyticsjs/enhanced-ecommerce#impression-data
         * @param id
         * @param name
         * @param list
         * @param brand
         * @param category
         * @param variant
         * @param position
         * @param price
         * @private
         */
        // this._addImpression = function (id, name, list, brand, category, variant, position, price){
        //   _gaJs(function () {
        //     _brewTrack('_addImpression', id, name, list, brand, category, variant, position, price);
        //   });
        //   _analyticsJs(function () {
        //     if (that._enhancedEcommerceEnabled(true, 'addImpression')) {
        //       var includeFn = function (trackerObj) {
        //         return isPropertySetTo('trackEcommerce', trackerObj, true);
        //       };

        //       _gaMultipleTrackers(
        //         includeFn,
        //         'ec:addImpression',
        //         {
        //           id: id,
        //           name: name,
        //           category: category,
        //           brand: brand,
        //           variant: variant,
        //           list: list,
        //           position: position,
        //           price: price
        //         });
        //     }
        //   });
        // };

        /**
         * Add Promo
         * https://developers.google.com/analytics/devguides/collection/analyticsjs/enhanced-ecommerce
         * @param productId
         * @param name
         * @param creative
         * @param position
         * @private
         */
        // this._addPromo = function (productId, name, creative, position) {
        //   _gaJs(function () {
        //     _brewTrack('_addPromo', productId, name, creative, position);
        //   });
        //   _analyticsJs(function () {
        //     if (that._enhancedEcommerceEnabled(true, 'addPromo')) {
        //       var includeFn = function (trackerObj) {
        //         return isPropertySetTo('trackEcommerce', trackerObj, true);
        //       };

        //       _gaMultipleTrackers(
        //         includeFn,
        //         'ec:addPromo',
        //         {
        //           id: productId,
        //           name: name,
        //           creative: creative,
        //           position: position
        //         });
        //     }
        //   });
        // };

        /**
         * Set Action
         * https://developers.google.com/analytics/devguides/collection/analyticsjs/enhanced-ecommerce#measuring-actions
         * https://developers.google.com/analytics/devguides/collection/analyticsjs/enhanced-ecommerce#action-types
         * @param action
         * @param obj
         * @private
         */
        // this._setAction = function (action, obj){
        //   _gaJs(function () {
        //     _brewTrack('_setAction', action, obj);
        //   });
        //   _analyticsJs(function () {
        //     if (that._enhancedEcommerceEnabled(true, 'setAction')) {
        //       var includeFn = function (trackerObj) {
        //         return isPropertySetTo('trackEcommerce', trackerObj, true);
        //       };

        //       _gaMultipleTrackers(includeFn, 'ec:setAction', action, obj);
        //     }
        //   });
        // };

        /**
         * Track Transaction
         * https://developers.google.com/analytics/devguides/collection/analyticsjs/enhanced-ecommerce#measuring-transactions
         * @param transactionId
         * @param affiliation
         * @param revenue
         * @param tax
         * @param shipping
         * @param coupon
         * @param list
         * @param step
         * @param option
         * @private
         */
        // this._trackTransaction = function (transactionId, affiliation, revenue, tax, shipping, coupon, list, step, option) {
        //   this._setAction('purchase', getActionFieldObject(transactionId, affiliation, revenue, tax, shipping, coupon, list, step, option));
        // };

        /**
         * Track Refund
         * https://developers.google.com/analytics/devguides/collection/analyticsjs/enhanced-ecommerce#measuring-refunds
         * @param transactionId
         * @private
         */
        // this._trackRefund = function (transactionId) {
        //   this._setAction('refund', getActionFieldObject(transactionId));
        // };

        /**
         * Track Checkout
         * https://developers.google.com/analytics/devguides/collection/analyticsjs/enhanced-ecommerce#measuring-checkout
         * @param step
         * @param option
         * @private
         */
        // this._trackCheckOut = function (step, option) {
        //   this._setAction('checkout', getActionFieldObject(null, null, null, null, null, null, null, step, option));
        // };

        /**
         * Track detail
         * @private
         */
        // this._trackDetail = function () {
        //   this._setAction('detail');
        //   this._pageView();
        // };

        /**
         * Track add/remove to cart
         * https://developers.google.com/analytics/devguides/collection/analyticsjs/enhanced-ecommerce#add-remove-cart
         * @param action
         * @param list
         * @private
         */
        // this._trackCart = function (action, listName) {
        //   if (['add', 'remove'].indexOf(action) !== -1) {
        //     this._setAction(action, { list: listName });
        //     this._trackEvent('UX', 'click', action + (action === 'add' ? ' to cart' : ' from cart'));
        //   }
        // };

        /**
         * Track promo click
         * https://developers.google.com/analytics/devguides/collection/analyticsjs/enhanced-ecommerce#measuring-promo-clicks
         * @param promotionName
         * @private
         */
        // this._promoClick = function (promotionName) {
        //   this._setAction('promo_click');
        //   this._trackEvent('Internal Promotions', 'click', promotionName);
        // };

        /**
         * Track product click
         * https://developers.google.com/analytics/devguides/collection/analyticsjs/enhanced-ecommerce#measuring-promo-clicks
         * @param promotionName
         * @private
         */
        // this._productClick = function (listName) {
        //   this._setAction('click', getActionFieldObject(null, null, null, null, null, null, listName, null, null));
        //   this._trackEvent('UX', 'click', listName);
        // };

        /**
         * Send page view
         * @param trackerName
         * @private
         */
        // this._pageView = function (trackerName) {
        //   _analyticsJs(function () {
        //     _ga(generateCommandName('send', trackerName), 'pageview');
        //   });
        // };

        /**
         * Send custom events
         * https://developers.google.com/analytics/devguides/collection/analyticsjs/user-timings#implementation
         * https://developers.google.com/analytics/devguides/collection/analyticsjs/social-interactions#implementation
         * @private
         */
        // this._send = function () {
        //   var args = Array.prototype.slice.call(arguments);
        //   args.unshift('send');
        //   _analyticsJs(function () {
        //     _ga.apply(that, args);
        //   });
        // };

        /**
         * Set custom dimensions, metrics or experiment
         * https://developers.google.com/analytics/devguides/collection/analyticsjs/custom-dims-mets
         * https://developers.google.com/analytics/devguides/collection/analyticsjs/field-reference#customs
         * @param name (Required)
         * @param value (Required)
         * @param trackerName (Optional)
         * @private
         */
        // this._set = function (name, value, trackerName) {
        //   _analyticsJs(function () {
        //     _ga(generateCommandName('set', trackerName), name, value);
        //   });
        // };

        /**
         * Track user timings
         * @param timingCategory (Required): A string for categorizing all user timing variables into logical groups(e.g jQuery).
         * @param timingVar (Required): A string to identify the variable being recorded(e.g. JavaScript Load).
         * @param timingValue (Required): The number of milliseconds in elapsed time to report to Google Analytics(e.g. 20).
         * @param timingLabel (Optional): A string that can be used to add flexibility in visualizing user timings in the reports(e.g. Google CDN).
         * @private
         */
        // this._trackTimings = function (timingCategory, timingVar, timingValue, timingLabel) {
        //   _analyticsJs(function () {
        //     _gaMultipleTrackers(undefined, 'send', 'timing', timingCategory, timingVar, timingValue, timingLabel);
        //   });
        // };

        /**
         * Exception tracking
         * https://developers.google.com/analytics/devguides/collection/analyticsjs/exceptions
         * @param description (Optional): A description of the exception.
         * @param isFatal (Optional): true if the exception was fatal, false otherwise.
         * @private
         */
        // this._trackException = function (description, isFatal) {
        //   _analyticsJs(function () {
        //     _gaMultipleTrackers(undefined, 'send', 'exception', { exDescription: description, exFatal: !!isFatal});
        //   });
        // };

        /**
         * Sets the userID to connect tracking to a user
         * @param userId: Id of the user, it can be an email address, integer or UUID which identifes a user uniquely in your system.
         * @private
         */
        this._setUserId = function(userId) {
          _baJs(function() {
            _brewTrack('setUserId', userId);
          });
        };

        // creates the BrewEngage Analytics tracker
        if (!delayScriptTag) {
          this._registerScriptTags();
          this._registerTrackers();
        }

        // activates page tracking
        if (trackRoutes) {
          switch (routerType)
          {
            case CONST_ROUTER_TYPE.UI_ROUTER: // ui-router
            {
              $rootScope.$on(pageEvent, function (event, toState, toParams, fromState, fromParams) {
                // Apply $route based filtering if configured
                if (readFromRoute) {
                  // set current route object
                  $route.current = toState;
  
                  // Avoid tracking undefined routes, routes without template (e.g. redirect routes)
                  // and those explicitly marked as 'do not track'
                  if (!$route.current || !$route.current.templateUrl || $route.current.baDoNotTrack) {
                    return;
                  }
                } 

                that._trackPage();
              });
              break;
            } 
            case CONST_ROUTER_TYPE.NG_ROUTER: // ngRoute
            {
              $rootScope.$on(pageEvent, function (event, next, current) {
                // Apply $route based filtering if configured
                if (readFromRoute) {
                  // Avoid tracking undefined routes, routes without template (e.g. redirect routes)
                  // and those explicitly marked as 'do not track'
                  if (!$route.current || !$route.current.templateUrl || $route.current.baDoNotTrack) {
                    return;
                  }
                }
                
                that._trackPage();
              });
              break;              
            }
            default: break;
          }
        }

        return {
          log: that.log,
          offlineQueue: that.offlineQueue,
          configuration: {
            accounts: accounts,
            universalAnalytics: analyticsJS,
            crossDomainLinker: crossDomainLinker,
            crossLinkDomains: crossLinkDomains,
            currency: currency,
            debugMode: debugMode,
            delayScriptTag: delayScriptTag,
            disableAnalytics: disableAnalytics,
            displayFeatures: displayFeatures,
            domainName: domainName,
            ecommerce: that._ecommerceEnabled(),
            enhancedEcommerce: that._enhancedEcommerceEnabled(),
            enhancedLinkAttribution: enhancedLinkAttribution,
            experimentId: experimentId,
            hybridMobileSupport: hybridMobileSupport,
            ignoreFirstPageLoad: ignoreFirstPageLoad,
            logAllCalls: logAllCalls,
            pageEvent: pageEvent,
            readFromRoute: readFromRoute,
            removeRegExp: removeRegExp,
            testMode: testMode,
            traceDebuggingMode: traceDebuggingMode,
            trackPrefix: trackPrefix,
            trackRoutes: trackRoutes,
            trackUrlParams: trackUrlParams,
            routerType: routerType,
            userId: userId,
            enableLinkTracking:  enableLinkTracking,
            enableHeartBeatTimer: enableHeartBeatTimer
          },
          getUrl: getUrl,
          getTitle: getTitle,
          /* DEPRECATED */
          // setCookieConfig: function (config) {
          //   that._log('warn', 'DEPRECATION WARNING: setCookieConfig method is deprecated. Please use tracker fields instead.');
          //   return that._setCookieConfig.apply(that, arguments);
          // },
          /* DEPRECATED */
          // getCookieConfig: function () {
          //   that._log('warn', 'DEPRECATION WARNING: getCookieConfig method is deprecated. Please use tracker fields instead.');
          //   return cookieConfig;
          // },
          /* DEPRECATED */
          // createAnalyticsScriptTag: function (config) {
          //   that._log('warn', 'DEPRECATION WARNING: createAnalyticsScriptTag method is deprecated. Please use registerScriptTags and registerTrackers methods instead.');
          //   if (config) {
          //     cookieConfig = config;
          //   }
          //   return that._createAnalyticsScriptTag();
          // },
          /* DEPRECATED */
          // createScriptTag: function () {
          //   that._log('warn', 'DEPRECATION WARNING: createScriptTag method is deprecated. Please use registerScriptTags and registerTrackers methods instead.');
          //   return that._createScriptTag();
          // },
          registerScriptTags: function () {
            return that._registerScriptTags();
          },
          registerTrackers: function () {
            return that._registerTrackers();
          },
          offline: function (mode) {
            if (mode === true && offlineMode === false) {
              // Go to offline mode
              offlineMode = true;
            }
            if (mode === false && offlineMode === true) {
              // Go to online mode and process the offline queue
              offlineMode = false;
              while (that.offlineQueue.length > 0) {
                var obj = that.offlineQueue.shift();
                obj[0].apply(that, obj[1]);
              }
            }
            return offlineMode;
          },

          trackPage: function (url, title, custom) {
            that._trackPage.apply(that, arguments);
          },
          trackEvent: function (category, action, label, value, noninteraction, custom) {
            that._trackEvent.apply(that, arguments);
          },
          addTrans: function (transactionId, affiliation, total, tax, shipping, city, state, country, currency) {
            that._addTrans.apply(that, arguments);
          },
          addItem: function (transactionId, sku, name, category, price, quantity) {
            that._addItem.apply(that, arguments);
          },
          trackTrans: function () {
            that._trackTrans.apply(that, arguments);
          },
          clearTrans: function () {
            that._clearTrans.apply(that, arguments);
          },
          addProduct: function (productId, name, category, brand, variant, price, quantity, coupon, position, custom) {
            that._addProduct.apply(that, arguments);
          },
          addPromo: function (productId, name, creative, position) {
            that._addPromo.apply(that, arguments);
          },
          addImpression: function (productId, name, list, brand, category, variant, position, price) {
            that._addImpression.apply(that, arguments);
          },
          productClick: function (listName) {
            that._productClick.apply(that, arguments);
          },
          promoClick : function (promotionName) {
            that._promoClick.apply(that, arguments);
          },
          trackDetail: function () {
            that._trackDetail.apply(that, arguments);
          },
          trackCart: function (action, list) {
            that._trackCart.apply(that, arguments);
          },
          trackCheckout: function (step, option) {
            that._trackCheckOut.apply(that, arguments);
          },
          trackTimings: function (timingCategory, timingVar, timingValue, timingLabel) {
            that._trackTimings.apply(that, arguments);
          },
          trackTransaction: function (transactionId, affiliation, revenue, tax, shipping, coupon, list, step, option) {
            that._trackTransaction.apply(that, arguments);
          },
          trackException: function (description, isFatal) {
            that._trackException.apply(that, arguments);
          },
          setAction: function (action, obj) {
            that._setAction.apply(that, arguments);
          },
          pageView: function () {
            that._pageView.apply(that, arguments);
          },

          // send: function (obj) {
          //   that._send.apply(that, arguments);
          // },
          // set: function (name, value, trackerName) {
          //   that._set.apply(that, arguments);
          // },

          setUserId: function () {
            that._setUserId.apply(that, arguments);
          }
        };
      }];
    })

    .directive('baTrackEvent', ['Analytics', '$parse', function (Analytics, $parse) {
      return {
        restrict: 'A',
        link: function (scope, element, attrs) {
          var options = $parse(attrs.baTrackEvent);
          element.bind('click', function () {
            if(attrs.baTrackEventIf){
              if(!scope.$eval(attrs.baTrackEventIf)){
                return; // Cancel this event if we don't pass the ba-track-event-if condition
              }
            }
            if (options.length > 1) {
              Analytics.trackEvent.apply(Analytics, options(scope));
            }
          });
        }
      };
    }]);
  return angular.module('angular-brew-analytics');
}));

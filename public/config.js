/**
 * Consent-Page API base URL config.
 * Uses localhost when served from localhost/127.0.0.1, otherwise production.
 */
(function(global) {
  'use strict';

  var LOCAL_PORT = 3000;
  var PRODUCTION_BASE = 'https://dpdp.dev4fun.science';

  var isLocal = /localhost|127\.0\.0\.1/.test(global.location.hostname);
  var base = isLocal ? 'http://localhost:' + LOCAL_PORT : PRODUCTION_BASE;

  global.CMP_BASE_URLS = {
    apiBaseUrl: base + '/consent',
    publicApiBaseUrl: base + '/public/policies'
  };
})(typeof window !== 'undefined' ? window : this);

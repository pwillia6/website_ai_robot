<?php

namespace WebRobot;

require_once __DIR__ . '/../etc/oauth_authorization.php';

class OAuth {

    var $type = 'unknown';
    
    /**
     * Sets the OAuth provider in the session.
     * @param string $provider The name of the provider (e.g., 'google', 'microsoft').
     */
    static function setProvider($provider) {
        $_SESSION['WebRobot::oauth_provider'] = $provider;
    }

    /**
     * Returns a list of configured OAuth providers.
     * @return array A list of provider names (e.g., ['google', 'microsoft']).
     */
    static function getConfiguredProviders() {
        $providers = [];
        $configFile = __DIR__ . '/../etc/oauth_credentials.json';
        if (!file_exists($configFile)) {
            // If the file doesn't exist, no providers are configured.
            error_log("OAuth credentials file not found for getConfiguredProviders: {$configFile}");
            return $providers;
        }

        $configData = json_decode(file_get_contents($configFile), true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            // If JSON is invalid, treat as no providers configured.
            error_log("Error decoding JSON from oauth_credentials.json for getConfiguredProviders: " . json_last_error_msg());
            return $providers;
        }

        if (isset($configData['google']) && !empty($configData['google']['client_id'])) {
            $providers[] = 'google';
        }
        if (isset($configData['microsoft']) && !empty($configData['microsoft']['client_id'])) {
            $providers[] = 'microsoft';
        }

        return $providers;
    }

    /**
     * Initializes and returns the OAuth object from the session.
     * If no provider is set in the session, it returns false.
     * @param string $returnURL The URL to return to after authentication.
     * @return OAuth|false The OAuth object or false if initialization fails.
     */
    static function initialize($returnURL) {
        if (isset($_SESSION["WebRobot::OAuth"])) {
            return $_SESSION["WebRobot::OAuth"];
        }

        if (!isset($_SESSION['WebRobot::oauth_provider'])) {
            return false;
        }

        // Load credentials from JSON file
        $configFile = __DIR__ . '/../etc/oauth_credentials.json';
        if (!file_exists($configFile)) {
            error_log("OAuth credentials file not found: {$configFile}");
            return false;
        }
        $configData = json_decode(file_get_contents($configFile), true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log("Error decoding JSON from oauth_credentials.json: " . json_last_error_msg());
            return false;
        }

        $provider = $_SESSION['WebRobot::oauth_provider'];
        $redirectUri = 'https://' . $_SERVER['HTTP_HOST'] . "/login.php";

        if ($provider === 'microsoft') {
            if (!isset($configData['microsoft'])) {
                error_log("Microsoft OAuth credentials not found in {$configFile}");
                return false;
            }
            $ms_config = $configData['microsoft'];
            $oauth = new \WebRobot\OAuth (
                'Microsoft', 
                $ms_config['client_id'], 
                $ms_config['client_secret'], 
                $redirectUri, $returnURL, 
                array('tenant' => $ms_config['tenant']));
        } else { // Default to Google
            if (!isset($configData['google'])) {
                error_log("Google OAuth credentials not found in {$configFile}");
                return false;
            }
            $g_config = $configData['google'];
            $oauth = new OAuth(
                'Google', 
                $g_config['client_id'], 
                $g_config['client_secret'], 
                $redirectUri, 
                $returnURL);
        }
        $_SESSION["WebRobot::OAuth"] = $oauth;

        return $_SESSION["WebRobot::OAuth"];
    }
    
    static function reset() {
        unset($_SESSION["WebRobot::OAuth"]);
    }
    
    function __construct($Type, $ClientID, $ClientSecret, $RedirectURL, $ReturnURL, $options = array()) {
        if ($Type=='Google') {
            $this->config = (object) array(
                'type' => 'Google',
                'client_id' => $ClientID,
                'client_secret' => $ClientSecret,
                'grant_type' => 'authorization_code',
                'redirect_uri' => $RedirectURL,
                'TokenURL' => 'https://www.googleapis.com/oauth2/v4/token',
                'AuthURL' => 'https://accounts.google.com/o/oauth2/v2/auth',
                'apiURL' => 'https://people.googleapis.com',
                'scope' => 'openid email profile',
            );
        } elseif ($Type == 'Microsoft') {
            $tenant = isset($options['tenant']) ? $options['tenant'] : 'common';
            $this->config = (object) array(
                'type' => 'Microsoft',
                'client_id' => $ClientID,
                'client_secret' => $ClientSecret,
                'grant_type' => 'authorization_code',
                'redirect_uri' => $RedirectURL,
                'TokenURL' => "https://login.microsoftonline.com/{$tenant}/oauth2/v2.0/token",
                'AuthURL' => "https://login.microsoftonline.com/{$tenant}/oauth2/v2.0/authorize",
                'apiURL' => 'https://graph.microsoft.com/v1.0/',
                'scope' => 'openid profile email User.Read',
                'tenant' => $tenant,
            );
        }
        $this->type = $Type;
        $this->returnURL  = $ReturnURL;
    }

    /*
     * WARNING: For security reasons avoid logging this on production servers.
     *
     * For debug and test, put suitable error_log() here to see internal OAuth process.
     */
    function log($s) {
        error_log("OAuth: " . $s);
        return;
    }

    /* Create a new taken from the refresh token if possible */
    function newToken() {
        if (!isset($this->refreshToken)) {
            return FALSE;
        }
        
        $config = $this->config;
        $params = array(
            'refresh_token' => $this->refreshToken,
            'client_id'     => $config->ClientID,
            'client_secret' => $config->ClientSecret,
            'grant_type'    => 'refresh_token'
        );
        
        $result = $this->_api($config->TokenURL, $params, 'POST');
        
        if (isset($result->access_token)) {
            $this->token = $result->access_token;
            $this->expires = time() +  $result->expires_in;
            $this->offset = 0;
            return true;
        }
        
        return false;
    }

    function getLoginUrl($RedirectURL = null, $Permissions = null) {
        if ($this->config->type=='Token') {
            $params = array(
                'check_token' => $this->config->token,
                'email' => $this->config->email,
            );
            return $this->config->AuthURL . '?' . http_build_query($params);
        }
    
        if ($this->config->type=='Facebook') {
            $params = array(
                'client_id' => $this->config->client_id,
                'state' => md5(session_id()),
                'response_type' => 'code',
                'redirect_uri' => $this->config->redirect_uri,
                'scope' => $this->config->scope,
            );
            return $this->config->AuthURL . '?' . http_build_query($params);
        }
        if ($this->config->type=='Google') {
            $params = array(
                'client_id' => $this->config->client_id,
                'state' => md5(session_id()),
                'response_type' => 'code',
                'redirect_uri' => $this->config->redirect_uri,
                'scope' => $this->config->scope
            );
            return $this->config->AuthURL . '?' . http_build_query($params);
        }
        if ($this->config->type=='Microsoft') {
            $params = array(
                'client_id' => $this->config->client_id,
                'state' => md5(session_id()),
                'response_type' => 'code',
                'redirect_uri' => $this->config->redirect_uri,
                'scope' => $this->config->scope,
            );
            return $this->config->AuthURL . '?' . http_build_query($params);
        }
    }

    function loggedIn() {
        return isset($this->token) &&  $this->checkExpiredToken();
    }
    


    /* Checks for expired token and refreshes if required */
    private function checkExpiredToken()
    {
        if (isset($this->token) && isset($this->expires)) {
            $minutesLeft = ($this->expires - time())/60 ;
            if ($minutesLeft < 10) {
                unset($this->token);
                unset($this->expires);
                unset($this->offset);
                return $this->newToken();
            }
        }
        return true;
    }
    
    
    /* This call ensures we are logged in - token stored in $this->token */
    function login() {
        
       
        /* So we don't re-process the same code */
        if (!isset($this->codes)) {
            $this->codes = array();
        }

        if (isset($_GET['code']) && !isset($this->codes[$_GET['code']])){
            $params = array(
                'code' => $_GET['code'],
                'client_id' => $this->config->client_id,
                'client_secret' => $this->config->client_secret,
                'redirect_uri' => $this->config->redirect_uri,
                'response_type'   => 'code',
                'grant_type' => 'authorization_code'
            );
            $this->codes[$_GET['code']] = TRUE;
      
            $this->result = $result = $this->_api($this->config->TokenURL, $params, 'POST');
            if (isset($result->access_token)) {
                $this->result = $result;
                $this->token  = $result->access_token;
                $this->expires =  time() + $result->expires_in;
                header( 'Location: ' . $this->returnURL);
                exit;
            } else {
                return false;
            }
        }

        if (!$this->loggedIn()) {
            $loginUrl = $this->getLoginUrl();
            header("Location: $loginUrl");
            exit;
        }

        return true;
    }

    /*
     * Logout of OAuth
     */
    function logout() {
			
        $instance = Instance::get(); // global $instance;
        $config = $this->config;

        if (isset($instance->LogoutURL) && !is_null($instance->LogoutURL) && $instance->LogoutURL != '') {
            $url = $instance->LogoutURL;
        } else {
            $url = preg_replace('@authorize[/]*$@','revoke', $instance->OAuthURL);
        }

        $parms = array(
            'token' => $this->token->token,
            'client_id' => $config->ClientID,
            'client_secret' => $config->ClientSecret,
        );

        $r = $this->_api($url, $parms, 'POST');

        return $r;
    }
    
    function api($url, $parms = array(), $fromethod = 'GET') {
        if (!preg_match('/^https:/', $url)) {
            $url = $this->config->apiURL . '/' . $url;
        }
        return $this->_api($url, $parms, $fromethod);
    }
    
    /* Basic api call */
    function _api($url, $parms = array(), $fromethod = 'GET')
    {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0 (Windows; U; Windows NT 5.1; en-US; rv:1.8.1.6) Gecko/20070725 Firefox/2.0.0.6");
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true); // More secure

        if (isset($this->token)) {
            $headers = array();
            $headers[] = 'Authorization: Bearer ' . $this->token;
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        }
        
        if ($fromethod == 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($parms));
        } else { // GET
            if (count($parms) > 0) {
                $url = $url . '?' . http_build_query($parms);
            }
        }

        curl_setopt($ch, CURLOPT_URL, $url);
        self::log("API: $url");
        if ($fromethod == 'POST') {
            self::log("API POST PARMS: " . json_encode($parms));
        }

        $responseBody = curl_exec($ch);
        $httpStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($responseBody === false) {
            $resp = (object) array(
              'error' => 'CURL - ' . $curlError,
              'url' => $url,
            );
            self::log(get_class() . '::_api failure: ' . $curlError, 'ERROR', $url);
            return $resp;
        }

        // The token endpoint returns 200 on success. Other API calls might too.
        // If not 200, it's an error.
        if ($httpStatus != 200) {
            $resp = (object) array(
              'error' => "Error status returned $httpStatus",
              'status' => $httpStatus,
              'url' => $url,
              'response' => $responseBody,
            );
            self::log(get_class() . '::_api bad status ' . $httpStatus, 'ERROR', $url);
            self::log(get_class() . '::_api response body', 'DEBUG', $responseBody);
            return $resp;
        }
        
        self::log("API RESPONSE:" . $responseBody);
        
        $decodedResponse = json_decode($responseBody, false);
        
        // If decoding fails, it's not JSON. Return the raw body.
        // For token exchange, this will cause `isset($result->access_token)` to fail, which is correct.
        if (json_last_error() !== JSON_ERROR_NONE) {
            self::log("API JSON DECODE ERROR: " . json_last_error_msg());
            return $responseBody;
        }
        
        return $decodedResponse;
    }


    
    function decodeJwtToken($jwt) {

        function base64UrlDecode($input) {
           $remainder = strlen($input) % 4;
           if ($remainder) {
               $input .= str_repeat('=', 4 - $remainder);
           }
           return base64_decode(strtr($input, '-_', '+/'));
        }
    
        $parts = explode('.', $jwt);
        if (count($parts) !== 3) {
            return array('error' => 'Invalid token format');
        }
    
        list($headerB64, $payloadB64, $signatureB64) = $parts;
    
        // Decode header and payload
        $header = json_decode(base64UrlDecode($headerB64), true);
        $payload = json_decode(base64UrlDecode($payloadB64), true);
    
        if (!$header || !$payload) {
            return array('error' => 'Invalid header or payload encoding');
        }
    
        // No signature verification
        return (object) $payload; // Return the decoded payload as an associative array
    }  

    function user($user=null) {

        if (isset($this->user)) {
           return $this->user;
        }

        if (isset($this->result->id_token)) {
            $decoded_token = $this->decodeJwtToken($this->result->id_token);
            if (isset($decoded_token->email) || isset($decoded_token->preferred_username)) {
                 $decoded_token->email = isset($decoded_token->email) ? $decoded_token->email : $decoded_token->preferred_username;
                 $this->user = $decoded_token;
            }
        };

        if (!isset($this->user)) {
            if ($this->type=='Google') {
                $r = $this->api('v1/people/me?personFields=names,emailAddresses');
                
                $user = (object) array(
                    'given_name' => isset($r->names[0]->givenName) ? $r->names[0]->givenName : '',
                    'last_name' => isset($r->names[0]->familyName) ? $r->names[0]->familyName : '',
                    'email'     => isset($r->emailAddresses[0]->value) ? $r->emailAddresses[0]->value : '',
                    'id'        => isset($r->names[0]->metadata->source->id) ? $r->names[0]->metadata->source->id : '',
                );
                $user->id_field = 'GOOGLEID';
                $this->user = $user;
            }

            if ($this->type=='Microsoft') {
                $r = $this->api('me');
                
                $user = (object) array(
                    'given_name' => $r->givenName,
                    'last_name' => $r->surname,
                    'email'     => isset($r->mail) ? $r->mail : $r->userPrincipalName,
                    'id'        => $r->id,
                );
                $this->user = $user;
            }
        }

        return $this->user;
    }
       
}
  


class WebRobotLoginChecker_OAuth implements LoginCheckerInterface
{
    /**
     * WebRobotLoginChecker_OAuth constructor.
     * This checker does not require any specific configuration from webrobot_config.json
     * as the OAuth class handles its own configuration loading.
     *
     * @param array $configData The main configuration data (unused by this class).
     */
    public function __construct(array $configData)
    {
        // This particular checker doesn't need configuration passed to it.
    }

    /**
     * Checks if the user is logged in and authorized.
     *
     * @return bool|string Returns true if logged in, or a URL string to redirect to if not.
     */
    public function isLoggedIn()
    {
        if (session_status() == PHP_SESSION_NONE) {
            session_start();
        }

        // The OAuth object needs the redirect URI for the OAuth flow, which is login.php
        $oauth = \WebRobot\OAuth::initialize('/login.php');

        if ($oauth === false || !$oauth->loggedIn()) {
            // User is not logged in. Store the page they are on to redirect back after login.
            // The Referer header should contain the URL of the page the user is on.
            if (isset($_SERVER['HTTP_REFERER'])) {
                $_SESSION['WebRobot::login_redirect'] = $_SERVER['HTTP_REFERER'];
            } else {
                // Fallback if referer is not available
                $_SESSION['WebRobot::login_redirect'] = '/';
            }
            return '/login.php';
        }

        // User has a session, check if they are authorized.
        $user = $oauth->user();
        if (!isset($user->email)) {
             // Invalid user object, treat as not logged in.
             return '/login.php';
        }
        $email = strtolower($user->email);

        if (!\isAuthorized($email)) {
            return '/login.php';
        }

        return true;
    }
}

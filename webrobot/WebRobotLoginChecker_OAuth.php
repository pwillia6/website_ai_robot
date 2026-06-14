<?php

namespace WebRobot;

require_once __DIR__ . '/../lib/autoloader.php';
require_once __DIR__ . '/../lib/authorization.php';
require_once __DIR__ . '/LoginCheckerInterface.php';

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
        $oauth = \OAuth::initialize('/login.php');

        if ($oauth === false || !$oauth->loggedIn()) {
            // User is not logged in. Store the page they are on to redirect back after login.
            // The Referer header should contain the URL of the page the user is on.
            if (isset($_SERVER['HTTP_REFERER'])) {
                $_SESSION['login_redirect'] = $_SERVER['HTTP_REFERER'];
            } else {
                // Fallback if referer is not available
                $_SESSION['login_redirect'] = '/';
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
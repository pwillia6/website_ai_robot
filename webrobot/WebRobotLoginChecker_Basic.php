<?php

namespace WebRobot;

require_once __DIR__ . '/LoginCheckerInterface.php';

class WebRobotLoginChecker_Basic implements LoginCheckerInterface
{
    /**
     * WebRobotLoginChecker_Basic constructor.
     *
     * @param array $configData The configuration data from webrobot_config.json (unused by this checker).
     */
    public function __construct(array $configData)
    {
        // Configuration from webrobot_config.json is not needed as Apache handles user authentication.
    }

    /**
     * Checks if the user is logged in via Apache Basic Auth.
     * Assumes Apache is configured to handle authentication (e.g., via .htaccess and .htpasswd).
     *
     * @return bool Returns true if logged in, false otherwise.
     */
    public function isLoggedIn()
    {
        if (isset($_SERVER['PHP_AUTH_USER']) && !empty($_SERVER['PHP_AUTH_USER'])) {
            // If PHP_AUTH_USER is set, it means Apache has successfully authenticated the user.
            return true;
        }

        // If PHP_AUTH_USER is not set, the user is not authenticated.
        return false;
    }
}
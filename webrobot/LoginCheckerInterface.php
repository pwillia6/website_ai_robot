<?php

namespace WebRobot;

interface LoginCheckerInterface {
    /**
     * LoginCheckerInterface constructor.
     *
     * @param array $configData The configuration data from webrobot_config.json.
     */
    public function __construct(array $configData);

    /**
     * Checks if the user is logged in and authorized.
     *
     * @return bool|string Returns true if logged in, or a URL string to redirect to if not.
     */
    public function isLoggedIn();
}